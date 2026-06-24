/**
 * License API 路由
 *
 * 提供 License 验证和报告签名服务。
 * 私钥仅存于服务端环境变量，公钥可公开。
 */

import { Hono } from 'hono';
import { authMiddleware, getUser } from '../middleware/auth.js';
import { signReport, verifyReportSignature, signReportUnverified } from '@labanimal/compliance';
import { sha256 } from '@labanimal/compliance';

const license = new Hono();

/** License 配置（每次请求动态读取环境变量，支持测试时注入） */
function getConfig() {
  const privateKey = process.env.LICENSE_PRIVATE_KEY || '';
  const publicKey = process.env.LICENSE_PUBLIC_KEY || '';
  return {
    privateKey,
    publicKey,
    deployId: process.env.LICENSE_DEPLOY_ID || 'open-source',
    maxAnimals: parseInt(process.env.LICENSE_MAX_ANIMALS || '500', 10),
    maxReports: parseInt(process.env.LICENSE_MAX_REPORTS_PER_MONTH || '3', 10),
    valid: !!privateKey && !!publicKey,
  };
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
license.post('/sign', authMiddleware, async (c) => {
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

  // 获取用户的实验室（用于审计日志）
  const { prisma } = await import('../lib/db.js');
  const membership = await prisma.userLab.findFirst({
    where: { userId: user.userId },
    select: { labId: true },
  });
  const labId = membership?.labId;

  // 检查月度报告限制
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const reportsThisMonth = await prisma.auditLog.count({
    where: {
      userId: user.userId,
      action: 'REPORT_SIGN',
      createdAt: { gte: monthStart, lte: monthEnd },
    },
  });

  if (reportsThisMonth >= config.maxReports) {
    return c.json({
      error: 'Monthly report signing limit reached',
      limit: config.maxReports,
      used: reportsThisMonth,
      message: `Open-source version allows ${config.maxReports} signed reports per month. Upgrade for unlimited reports.`,
    }, 403);
  }

  let signature: string;
  let status: 'verified' | 'unverified';

  if (config.valid) {
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
        diff: { status, deployId: config.deployId },
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
    return c.json({
      valid: false,
      error: 'no_public_key',
      message: 'License public key not configured. Cannot verify signatures.',
    }, 500);
  }

  const result = await verifyReportSignature(body.signature, config.publicKey, body.reportHash);
  return c.json(result);
});

/**
 * GET /api/license/status — 获取 License 状态
 */
license.get('/status', async (c) => {
  const config = getConfig();
  return c.json({
    deployId: config.deployId,
    hasLicense: config.valid,
    maxAnimals: config.maxAnimals,
    maxReportsPerMonth: config.maxReports,
    publicKeyConfigured: !!config.publicKey,
  });
});

export { license };
