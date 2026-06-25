import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import app from '../src/index.js';
import { prisma } from '../src/lib/db.js';
import { generateKeyPair } from '@labanimal/compliance';

const TEST_EMAIL = 'license-tester@test.lab';
const TEST_PASSWORD = 'Test1234!';
const TEST_NAME = 'License Tester';

let token: string;
let labId: string;

// 测试用 RSA 密钥对
const testKeys = generateKeyPair();

// 保存原始环境变量
const origPrivateKey = process.env.LICENSE_PRIVATE_KEY;
const origPublicKey = process.env.LICENSE_PUBLIC_KEY;
const origDeployId = process.env.LICENSE_DEPLOY_ID;

beforeAll(async () => {
  // 设置测试密钥
  process.env.LICENSE_PRIVATE_KEY = testKeys.privateKey;
  process.env.LICENSE_PUBLIC_KEY = testKeys.publicKey;
  process.env.LICENSE_DEPLOY_ID = 'test-deploy';

  // 清理测试用户和审计日志（避免月度报告限额影响测试）
  const existingUsers = await prisma.user.findMany({
    where: { email: TEST_EMAIL },
    select: { id: true },
  });
  if (existingUsers.length > 0) {
    await prisma.auditLog.deleteMany({ where: { userId: { in: existingUsers.map((u) => u.id) } } });
  }
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });

  // 注册测试用户
  const registerRes = await app.request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD, name: TEST_NAME }),
  });
  const registerData = await registerRes.json<{ token: string; labs: Array<{ id: string }> }>();
  token = registerData.token;

  // 创建实验室
  const labRes = await app.request('/api/labs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name: 'License Test Lab' }),
  });
  const labData = await labRes.json<{ id: string }>();
  labId = labData.id;
});

afterAll(async () => {
  // 恢复环境变量
  process.env.LICENSE_PRIVATE_KEY = origPrivateKey;
  process.env.LICENSE_PUBLIC_KEY = origPublicKey;
  process.env.LICENSE_DEPLOY_ID = origDeployId;

  // 清理
  await prisma.auditLog.deleteMany({
    where: {
      userId: {
        in: (
          await prisma.user.findMany({ where: { email: TEST_EMAIL }, select: { id: true } })
        ).map((u) => u.id),
      },
    },
  });
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  await prisma.$disconnect();
});

// ========== License Status ==========

describe('GET /api/license/status', () => {
  it('返回 License 状态', async () => {
    const res = await app.request('/api/license/status');
    expect(res.status).toBe(200);
    const data = await res.json<{
      deployId: string;
      hasLicense: boolean;
      maxAnimals: number;
      maxReportsPerMonth: number;
    }>();
    expect(data.deployId).toBe('test-deploy');
    expect(data.hasLicense).toBe(true);
    expect(data.maxAnimals).toBe(500);
    expect(data.maxReportsPerMonth).toBe(3);
  });
});

// ========== Report Signing ==========

describe('POST /api/license/sign', () => {
  const testReportHash = 'a'.repeat(64); // 64 字符的 hex 哈希

  it('签名报告成功', async () => {
    const res = await app.request('/api/license/sign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Lab-Id': labId,
      },
      body: JSON.stringify({ reportHash: testReportHash }),
    });
    expect(res.status).toBe(200);
    const data = await res.json<{
      signature: string;
      status: string;
      deployId: string;
      verifyUrl: string;
    }>();
    expect(data.signature).toBeTruthy();
    expect(data.status).toBe('verified');
    expect(data.deployId).toBe('test-deploy');
    expect(data.verifyUrl).toContain('labanimal.tech/verify?hash=');
  });

  it('使用 reportData 自动计算哈希', async () => {
    const res = await app.request('/api/license/sign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Lab-Id': labId,
      },
      body: JSON.stringify({ reportData: 'some report content here' }),
    });
    expect(res.status).toBe(200);
    const data = await res.json<{ signature: string; status: string }>();
    expect(data.signature).toBeTruthy();
    expect(data.status).toBe('verified');
  });

  it('缺少参数返回 400', async () => {
    const res = await app.request('/api/license/sign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('无 token 返回 401', async () => {
    const res = await app.request('/api/license/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportHash: testReportHash }),
    });
    expect(res.status).toBe(401);
  });
});

// ========== Report Verification ==========

describe('POST /api/license/verify', () => {
  // 每个测试前清理审计日志，避免月度报告限额影响
  beforeEach(async () => {
    const users = await prisma.user.findMany({
      where: { email: TEST_EMAIL },
      select: { id: true },
    });
    if (users.length > 0) {
      await prisma.auditLog.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
    }
  });

  it('验证签名成功', async () => {
    // 先签名
    const reportHash = 'b'.repeat(64);
    const signRes = await app.request('/api/license/sign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Lab-Id': labId,
      },
      body: JSON.stringify({ reportHash }),
    });
    const signData = await signRes.json<{ signature: string }>();

    // 再验证
    const verifyRes = await app.request('/api/license/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signature: signData.signature, reportHash }),
    });
    expect(verifyRes.status).toBe(200);
    const verifyData = await verifyRes.json<{ valid: boolean; data: { reportHash: string } }>();
    expect(verifyData.valid).toBe(true);
    expect(verifyData.data.reportHash).toBe(reportHash);
  });

  it('篡改哈希验证失败', async () => {
    const reportHash = 'c'.repeat(64);
    const signRes = await app.request('/api/license/sign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Lab-Id': labId,
      },
      body: JSON.stringify({ reportHash }),
    });
    const signData = await signRes.json<{ signature: string }>();

    // 用不同的哈希验证
    const verifyRes = await app.request('/api/license/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signature: signData.signature, reportHash: 'd'.repeat(64) }),
    });
    expect(verifyRes.status).toBe(200);
    const verifyData = await verifyRes.json<{ valid: boolean; error: string }>();
    expect(verifyData.valid).toBe(false);
    expect(verifyData.error).toBe('tampered');
  });

  it('缺少 signature 返回 400', async () => {
    const res = await app.request('/api/license/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});
