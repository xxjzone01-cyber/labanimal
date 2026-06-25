/**
 * License API 路由
 *
 * 提供 License 验证和报告签名服务。
 * 私钥仅存于服务端环境变量，公钥可公开。
 */

import { Hono } from 'hono';
import { authMiddleware, getUser } from '../middleware/auth.js';
import { billingWallMiddleware, canSignReport, getPlanLimits } from '../middleware/billing-wall.js';
import {
  signReport,
  verifyReportSignature,
  signReportUnverified,
  generateRenewalCode,
} from '@labanimal/compliance';
import { sha256 } from '@labanimal/compliance';
import type { Context, Next } from 'hono';

const license = new Hono();

/** License 配置（每次请求动态读取环境变量，支持测试时注入） */
function getConfig() {
  const privateKey = process.env.LICENSE_PRIVATE_KEY || '';
  const publicKey = process.env.LICENSE_PUBLIC_KEY || '';
  return {
    privateKey,
    publicKey,
    deployId: process.env.LICENSE_DEPLOY_ID || 'open-source',
    valid: !!privateKey && !!publicKey,
  };
}

/**
 * 确保 labId 可用的中间件
 * 如果 X-Lab-Id header 未提供，自动使用用户所属的第一个 lab
 */
async function ensureLabId(c: Context, next: Next): Promise<void> {
  const user = getUser(c);
  if (!user.labId) {
    const { prisma } = await import('../lib/db.js');
    const membership = await prisma.userLab.findFirst({
      where: { userId: user.userId },
      select: { labId: true },
    });
    if (membership) {
      user.labId = membership.labId;
      c.set('user', user);
    }
  }
  await next();
}

/**
 * POST /api/license/sign — 签名报告
 *
 * 请求体：
 * - reportHash: string — 报告内容的 SHA-256 哈希
 * - reportData?: string — 报告原始数据（可选，用于自动计算哈希）
 *
 * 返回：
 * - signature: Base64 编码的签名数据（嵌入 PDF）
 * - status: 'verified' | 'unverified'
 * - verifyUrl: 验证页面 URL
 */
license.post('/sign', authMiddleware, ensureLabId, billingWallMiddleware, async (c) => {
  const user = getUser(c);
  const body = await c.req.json<{ reportHash?: string; reportData?: string }>();
  const config = getConfig();

  // 计算或使用提供的哈希
  let reportHash = body.reportHash;
  if (!reportHash && body.reportData) {
    reportHash = await sha256(body.reportData);
  }

  if (!reportHash) {
    return c.json({ error: 'reportHash or reportData is required' }, 400);
  }

  const { prisma } = await import('../lib/db.js');
  const labId = user.labId;

  // 签名决策：私钥已配置 且 套餐允许签名 → verified，否则 → unverified
  const allowed = canSignReport(c);
  let signature: string;
  let status: 'verified' | 'unverified';

  if (config.valid && allowed) {
    signature = await signReport(reportHash, config.deployId, config.privateKey);
    status = 'verified';
  } else {
    signature = await signReportUnverified(reportHash, config.deployId);
    status = 'unverified';
  }

  // 记录审计日志
  if (labId) {
    const lastEntry = await prisma.auditLog.findFirst({
      where: { labId },
      orderBy: { createdAt: 'desc' },
      select: { hash: true },
    });

    await prisma.auditLog.create({
      data: {
        labId,
        userId: user.userId,
        action: 'REPORT_SIGN',
        entityType: 'Report',
        entityId: reportHash,
        diff: { status, deployId: config.deployId, signature },
        hash: reportHash,
        previousHash: lastEntry?.hash || '0'.repeat(64),
      },
    });
  }

  return c.json({
    signature,
    status,
    deployId: config.deployId,
    verifyUrl: `https://labanimal.tech/verify?hash=${reportHash}`,
    signedAt: new Date().toISOString(),
  });
});

/**
 * POST /api/license/verify — 验证报告签名
 *
 * 请求体：
 * - signature: Base64 编码的签名数据
 * - reportHash?: string — 要验证的报告哈希
 */
license.post('/verify', async (c) => {
  const body = await c.req.json<{ signature: string; reportHash?: string }>();
  const config = getConfig();

  if (!body.signature) {
    return c.json({ error: 'signature is required' }, 400);
  }

  if (!config.publicKey) {
    return c.json(
      {
        valid: false,
        error: 'no_public_key',
        message: 'License public key not configured. Cannot verify signatures.',
      },
      500,
    );
  }

  const result = await verifyReportSignature(body.signature, config.publicKey, body.reportHash);
  return c.json(result);
});

/**
 * GET /api/license/verify/:hash — 通过报告哈希查找签名并验证
 *
 * 从 AuditLog 中查找签名记录，使用公钥验证签名有效性。
 * 公开端点，无需认证（任何人可通过哈希验证报告真伪）。
 */
license.get('/verify/:hash', async (c) => {
  const reportHash = c.req.param('hash');
  const config = getConfig();

  if (!reportHash || reportHash.length !== 64) {
    return c.json(
      { valid: false, error: 'invalid_hash', message: '报告哈希必须是 64 位十六进制字符串' },
      400,
    );
  }

  const { prisma } = await import('../lib/db.js');

  // 从 AuditLog 查找签名记录
  const signEntry = await prisma.auditLog.findFirst({
    where: {
      action: 'REPORT_SIGN',
      entityId: reportHash,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!signEntry) {
    return c.json(
      {
        valid: false,
        error: 'not_found',
        message: '未找到此报告的签名记录。',
      },
      404,
    );
  }

  const diff = signEntry.diff as { status?: string; deployId?: string; signature?: string } | null;
  const signature = diff?.signature;
  const status = diff?.status;
  const deployId = diff?.deployId;

  if (!signature) {
    return c.json(
      {
        valid: false,
        error: 'no_signature',
        message: '签名记录中未包含签名数据。',
      },
      500,
    );
  }

  // 验证签名
  if (status === 'verified' && config.publicKey) {
    const result = await verifyReportSignature(signature, config.publicKey, reportHash);
    return c.json({
      ...result,
      data: {
        ...result.data,
        deployId,
        signedAt: signEntry.createdAt.toISOString(),
        reportHash,
        status,
      },
    });
  }

  // unverified 签名（降级/免费版）
  return c.json({
    valid: false,
    error: 'unverified',
    message: '此报告未使用 RSA 私钥签名（可能是免费版或超限降级）。',
    data: {
      deployId,
      signedAt: signEntry.createdAt.toISOString(),
      reportHash,
      status: status || 'unverified',
    },
  });
});

/**
 * GET /api/license/status — 获取 License 状态
 */
license.get('/status', async (c) => {
  const config = getConfig();
  const limits = getPlanLimits('academic-free');
  return c.json({
    deployId: config.deployId,
    hasLicense: config.valid,
    maxAnimals: limits.maxAnimals,
    maxReportsPerMonth: limits.maxReportsPerMonth,
    publicKeyConfigured: !!config.publicKey,
  });
});

/**
 * POST /api/license/renew — 生成离线续期码
 *
 * 请求体：
 * - deployId: string — 部署 ID
 *
 * 返回：
 * - renewalCode: Base64URL 编码的续期码（7 天有效）
 * - expiresAt: 过期时间 ISO 字符串
 */
license.post('/renew', async (c) => {
  const body = await c.req.json<{ deployId?: string }>();

  if (!body.deployId) {
    return c.json({ error: 'deployId is required' }, 400);
  }

  const secret = process.env.RENEWAL_SECRET || process.env.JWT_SECRET || 'default-renewal-secret';
  const renewalCode = generateRenewalCode(body.deployId, secret);
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 天

  return c.json({
    renewalCode,
    deployId: body.deployId,
    expiresAt: new Date(expiresAt).toISOString(),
    validDays: 7,
  });
});

export { license };
