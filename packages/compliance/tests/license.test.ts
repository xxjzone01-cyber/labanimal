import { describe, it, expect, beforeAll } from 'vitest';
import { generateKeyPair, isValidPublicKey, isValidPrivateKey } from '../src/license/keys.js';
import { signLicense, verifyLicense } from '../src/license/signer.js';
import { signReport, verifyReportSignature, signReportUnverified } from '../src/license/report-signature.js';
import {
  initOfflineGrace,
  updateOnlineStatus,
  checkGraceStatus,
  generateRenewalCode,
  verifyRenewalCode,
  OFFLINE_LIMITS,
} from '../src/license/offline-grace.js';
import type { LicensePayload, KeyPair, OfflineGraceState } from '../src/license/index.js';

// ========== 测试密钥对 ==========

let keys: KeyPair;
let keys2: KeyPair; // 用于密钥轮换测试

beforeAll(() => {
  keys = generateKeyPair();
  keys2 = generateKeyPair();
});

// ========== generateKeyPair ==========

describe('generateKeyPair', () => {
  it('生成有效的 RSA-2048 密钥对', () => {
    expect(keys.publicKey).toContain('-----BEGIN PUBLIC KEY-----');
    expect(keys.privateKey).toContain('-----BEGIN PRIVATE KEY-----');
  });

  it('每次生成不同的密钥对', () => {
    const keysB = generateKeyPair();
    expect(keysB.publicKey).not.toBe(keys.publicKey);
    expect(keysB.privateKey).not.toBe(keys.privateKey);
  });
});

// ========== isValidPublicKey / isValidPrivateKey ==========

describe('isValidPublicKey', () => {
  it('有效的 PEM 公钥返回 true', () => {
    expect(isValidPublicKey(keys.publicKey)).toBe(true);
  });

  it('无效 PEM 返回 false', () => {
    expect(isValidPublicKey('not-a-key')).toBe(false);
  });

  it('私钥不能作为公钥验证', () => {
    expect(isValidPublicKey(keys.privateKey)).toBe(false);
  });
});

describe('isValidPrivateKey', () => {
  it('有效的 PEM 私钥返回 true', () => {
    expect(isValidPrivateKey(keys.privateKey)).toBe(true);
  });

  it('无效 PEM 返回 false', () => {
    expect(isValidPrivateKey('not-a-key')).toBe(false);
  });
});

// ========== License 签名/验签 ==========

describe('signLicense / verifyLicense', () => {
  const validPayload: LicensePayload = {
    deployId: 'deploy-001',
    maxAnimals: 1000,
    maxReportsPerMonth: 10,
    complianceModules: ['basic', 'full'],
    issuedAt: Math.floor(Date.now() / 1000),
    expiresAt: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1 年后
  };

  it('正常签发 + 验证通过', async () => {
    const jwt = await signLicense(validPayload, keys.privateKey);
    expect(typeof jwt).toBe('string');
    expect(jwt.split('.')).toHaveLength(3); // header.payload.signature

    const result = await verifyLicense(jwt, keys.publicKey);
    expect(result.valid).toBe(true);
    expect(result.payload).not.toBeNull();
    expect(result.payload!.deployId).toBe('deploy-001');
    expect(result.payload!.maxAnimals).toBe(1000);
    expect(result.error).toBeUndefined();
  });

  it('过期 License 验证失败 (error: expired)', async () => {
    const expiredPayload: LicensePayload = {
      ...validPayload,
      expiresAt: Math.floor(Date.now() / 1000) - 3600, // 1 小时前过期
    };
    const jwt = await signLicense(expiredPayload, keys.privateKey);
    const result = await verifyLicense(jwt, keys.publicKey);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('expired');
    expect(result.payload).toBeNull();
  });

  it('篡改 payload 验证失败 (error: invalid_signature)', async () => {
    const jwt = await signLicense(validPayload, keys.privateKey);
    const parts = jwt.split('.');
    // 篡改 payload：修改 maxAnimals
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...validPayload, maxAnimals: 9999 }),
      'utf8'
    ).toString('base64url');
    const tamperedJwt = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    const result = await verifyLicense(tamperedJwt, keys.publicKey);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('invalid_signature');
  });

  it('畸形 JWT 返回 error: malformed', async () => {
    const result = await verifyLicense('not.a.valid.jwt.token', keys.publicKey);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('malformed');
  });

  it('两段式 JWT 返回 error: malformed', async () => {
    const result = await verifyLicense('only.two', keys.publicKey);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('malformed');
  });

  it('错误密钥验签失败 (error: invalid_signature)', async () => {
    const jwt = await signLicense(validPayload, keys.privateKey);
    const result = await verifyLicense(jwt, keys2.publicKey); // 用另一个密钥验签
    expect(result.valid).toBe(false);
    expect(result.error).toBe('invalid_signature');
  });

  it('payload 缺少必填字段返回 error: malformed', async () => {
    // 手动构造一个缺少字段的 JWT
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ deployId: 'test' })).toString('base64url');
    const { createSign } = await import('node:crypto');
    const signer = createSign('RSA-SHA256');
    signer.update(`${header}.${payload}`);
    const sig = signer.sign(keys.privateKey, 'base64url');
    const jwt = `${header}.${payload}.${sig}`;

    const result = await verifyLicense(jwt, keys.publicKey);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('malformed');
  });
});

// ========== 安全攻击测试 ==========

describe('安全攻击测试', () => {
  const validPayload: LicensePayload = {
    deployId: 'deploy-attack',
    maxAnimals: 500,
    maxReportsPerMonth: 3,
    complianceModules: ['basic'],
    issuedAt: Math.floor(Date.now() / 1000),
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  };

  it('alg:none 攻击被拒绝 (error: algorithm_not_allowed)', async () => {
    // 构造 alg:none JWT（无签名）
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify(validPayload)).toString('base64url');
    const jwt = `${header}.${payload}.`; // 空签名

    const result = await verifyLicense(jwt, keys.publicKey);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('algorithm_not_allowed');
  });

  it('alg:HS256 攻击被拒绝 (error: algorithm_not_allowed)', async () => {
    // 构造 alg:HS256 JWT（试图用对称算法替换非对称算法）
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify(validPayload)).toString('base64url');
    const jwt = `${header}.${payload}.fakesignature`;

    const result = await verifyLicense(jwt, keys.publicKey);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('algorithm_not_allowed');
  });

  it('签名重放（使用过期 License 的签名）被拒绝', async () => {
    // 签发一个过期的 License
    const expiredPayload: LicensePayload = {
      ...validPayload,
      expiresAt: Math.floor(Date.now() / 1000) - 100,
    };
    const jwt = await signLicense(expiredPayload, keys.privateKey);

    // 即使签名有效，过期检查也会失败
    const result = await verifyLicense(jwt, keys.publicKey);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('expired');
  });

  it('密钥轮换：旧密钥签发的 License 用新密钥验签失败', async () => {
    const jwt = await signLicense(validPayload, keys.privateKey); // 用 keys 签发
    const result = await verifyLicense(jwt, keys2.publicKey); // 用 keys2 验签
    expect(result.valid).toBe(false);
    expect(result.error).toBe('invalid_signature');
  });

  it('密钥轮换：新密钥签发的 License 用新密钥验签成功', async () => {
    const jwt = await signLicense(validPayload, keys2.privateKey);
    const result = await verifyLicense(jwt, keys2.publicKey);
    expect(result.valid).toBe(true);
    expect(result.payload!.deployId).toBe('deploy-attack');
  });

  it('无效公钥 PEM 验签返回 invalid_signature', async () => {
    const jwt = await signLicense(validPayload, keys.privateKey);
    const result = await verifyLicense(jwt, 'not-a-real-pem');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('invalid_signature');
  });

  it('非 JSON payload 返回 malformed', async () => {
    // 手动构造一个 payload 部分不是 JSON 的 JWT
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const badPayload = Buffer.from('not-json-at-all').toString('base64url');
    const { createSign } = await import('node:crypto');
    const signer = createSign('RSA-SHA256');
    signer.update(`${header}.${badPayload}`);
    const sig = signer.sign(keys.privateKey, 'base64url');
    const jwt = `${header}.${badPayload}.${sig}`;

    const result = await verifyLicense(jwt, keys.publicKey);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('malformed');
  });
});

// ========== 报告签名 ==========

describe('signReport / verifyReportSignature', () => {
  const testReportHash = 'abc123def456789012345678901234567890abcdef123456789012345678901234';

  it('正常签名 + 验证通过', async () => {
    const sig = await signReport(testReportHash, 'deploy-001', keys.privateKey);
    expect(typeof sig).toBe('string');

    const result = await verifyReportSignature(sig, keys.publicKey, testReportHash);
    expect(result.valid).toBe(true);
    expect(result.data).not.toBeNull();
    expect(result.data!.reportHash).toBe(testReportHash);
    expect(result.data!.deployId).toBe('deploy-001');
    expect(result.data!.status).toBe('verified');
    expect(result.verifyUrl).toContain('labanimal.tech/verify?hash=');
    expect(result.error).toBeUndefined();
  });

  it('篡改报告哈希验证失败 (error: tampered)', async () => {
    const sig = await signReport(testReportHash, 'deploy-001', keys.privateKey);
    const result = await verifyReportSignature(sig, keys.publicKey, 'tampered-hash');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('tampered');
    expect(result.data).not.toBeNull(); // 数据仍可解析
    expect(result.verifyUrl).toContain('labanimal.tech/verify?hash=');
  });

  it('篡改签名数据验证失败 (error: invalid_signature)', async () => {
    const sig = await signReport(testReportHash, 'deploy-001', keys.privateKey);
    // 解码后替换签名为无效值
    const decoded = Buffer.from(sig, 'base64').toString('utf8');
    const lastPipe = decoded.lastIndexOf('|');
    const payload = decoded.substring(0, lastPipe);
    const tamperedPayload = `${payload}|AAAA`; // 无效签名
    const tamperedBase64 = Buffer.from(tamperedPayload, 'utf8').toString('base64');

    const result = await verifyReportSignature(tamperedBase64, keys.publicKey, testReportHash);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('invalid_signature');
  });

  it('不提供报告哈希时只验证签名有效性', async () => {
    const sig = await signReport(testReportHash, 'deploy-001', keys.privateKey);
    const result = await verifyReportSignature(sig, keys.publicKey);
    expect(result.valid).toBe(true);
    expect(result.data!.reportHash).toBe(testReportHash);
  });

  it('未验证状态签名 (status: unverified) 验证失败', async () => {
    const sig = await signReportUnverified(testReportHash, 'deploy-001');
    const result = await verifyReportSignature(sig, keys.publicKey);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('unverified');
    expect(result.data).not.toBeNull();
    expect(result.data!.status).toBe('unverified');
  });

  it('签名过期（24 小时）验证失败 (error: signature_expired)', async () => {
    // 手动构造一个 25 小时前的签名数据
    const expiredData = {
      reportHash: testReportHash,
      deployId: 'deploy-001',
      signedAt: Date.now() - 25 * 60 * 60 * 1000, // 25 小时前
      status: 'verified' as const,
    };

    const { createSign } = await import('node:crypto');
    const payload = JSON.stringify(expiredData);
    const signer = createSign('RSA-SHA256');
    signer.update(payload);
    const signature = signer.sign(keys.privateKey, 'base64');
    const signedPayload = `${payload}|${signature}`;
    const sigBase64 = Buffer.from(signedPayload, 'utf8').toString('base64');

    const result = await verifyReportSignature(sigBase64, keys.publicKey);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('signature_expired');
    expect(result.data).not.toBeNull();
    expect(result.verifyUrl).toContain('labanimal.tech/verify?hash=');
  });

  it('错误格式的 Base64 返回 invalid_signature', async () => {
    const result = await verifyReportSignature('!!!invalid-base64!!!', keys.publicKey);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('invalid_signature');
  });

  it('缺少管道分隔符返回 invalid_signature', async () => {
    const noPipe = Buffer.from('no-pipe-separator', 'utf8').toString('base64');
    const result = await verifyReportSignature(noPipe, keys.publicKey);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('invalid_signature');
  });

  it('非 JSON 数据返回 invalid_signature', async () => {
    const notJson = Buffer.from('not-json-data|', 'utf8').toString('base64');
    const result = await verifyReportSignature(notJson, keys.publicKey);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('invalid_signature');
  });

  it('缺少必填字段返回 invalid_signature', async () => {
    const incomplete = Buffer.from(JSON.stringify({ reportHash: 'abc' }) + '|', 'utf8').toString('base64');
    const result = await verifyReportSignature(incomplete, keys.publicKey);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('invalid_signature');
  });

  it('verified 状态但签名为空返回 invalid_signature', async () => {
    const fakeVerified = Buffer.from(
      JSON.stringify({ reportHash: 'h', deployId: 'd', signedAt: Date.now(), status: 'verified' }) + '|',
      'utf8'
    ).toString('base64');
    const result = await verifyReportSignature(fakeVerified, keys.publicKey);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('invalid_signature');
  });

  it('无效公钥验签返回 invalid_signature', async () => {
    const sig = await signReport(testReportHash, 'deploy-001', keys.privateKey);
    const result = await verifyReportSignature(sig, 'not-a-real-pem', testReportHash);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('invalid_signature');
  });
});

// ========== 端到端流程 ==========

describe('端到端流程', () => {
  it('完整流程：生成密钥 → 签发 License → 签名报告 → 验证报告', async () => {
    // 1. 生成密钥对
    const kp = generateKeyPair();

    // 2. 签发 License
    const payload: LicensePayload = {
      deployId: 'e2e-deploy',
      maxAnimals: 500,
      maxReportsPerMonth: 3,
      complianceModules: ['basic'],
      issuedAt: Math.floor(Date.now() / 1000),
      expiresAt: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    };
    const licenseJwt = await signLicense(payload, kp.privateKey);

    // 3. 验证 License
    const licenseResult = await verifyLicense(licenseJwt, kp.publicKey);
    expect(licenseResult.valid).toBe(true);
    expect(licenseResult.payload!.deployId).toBe('e2e-deploy');

    // 4. 签名报告
    const reportHash = 'e2e-report-hash-1234567890abcdef';
    const reportSig = await signReport(reportHash, 'e2e-deploy', kp.privateKey);

    // 5. 验证报告
    const reportResult = await verifyReportSignature(reportSig, kp.publicKey, reportHash);
    expect(reportResult.valid).toBe(true);
    expect(reportResult.data!.reportHash).toBe(reportHash);
    expect(reportResult.data!.status).toBe('verified');
    expect(reportResult.verifyUrl).toBe(`https://labanimal.tech/verify?hash=${reportHash}`);
  });

  it('未验证部署：报告带 UNVERIFIED 状态', async () => {
    const reportHash = 'unverified-report-hash';
    const sig = await signReportUnverified(reportHash, 'unverified-deploy');

    const result = await verifyReportSignature(sig, keys.publicKey);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('unverified');
    expect(result.data!.status).toBe('unverified');
  });
});

// ========== 离线宽限期 ==========

describe('OFFLINE_LIMITS', () => {
  it('离线限额定义正确', () => {
    expect(OFFLINE_LIMITS.maxAnimals).toBe(500);
    expect(OFFLINE_LIMITS.maxReportsPerMonth).toBe(1);
  });
});

describe('initOfflineGrace', () => {
  it('初始化宽限期状态', () => {
    const state = initOfflineGrace('deploy-offline-001');
    expect(state.deployId).toBe('deploy-offline-001');
    expect(state.firstOfflineAt).toBeGreaterThan(0);
    expect(state.lastOnlineAt).toBe(state.firstOfflineAt);
    expect(state.graceExpiresAt).toBe(state.firstOfflineAt + 30 * 24 * 60 * 60 * 1000);
    expect(state.readOnly).toBe(false);
    expect(state.renewalExpiresAt).toBeUndefined();
  });

  it('每次初始化时间戳不同', async () => {
    const state1 = initOfflineGrace('deploy-1');
    // 等待 1ms 确保时间戳不同
    await new Promise((r) => setTimeout(r, 1));
    const state2 = initOfflineGrace('deploy-2');
    expect(state2.firstOfflineAt).toBeGreaterThanOrEqual(state1.firstOfflineAt);
  });
});

describe('updateOnlineStatus', () => {
  it('在线验证成功后重置宽限期', () => {
    const state = initOfflineGrace('deploy-001');
    const oldGraceExpires = state.graceExpiresAt;

    // 模拟一段时间后在线验证
    const updated = updateOnlineStatus(state);
    expect(updated.lastOnlineAt).toBeGreaterThanOrEqual(state.lastOnlineAt);
    expect(updated.graceExpiresAt).toBeGreaterThanOrEqual(oldGraceExpires);
    expect(updated.readOnly).toBe(false);
    expect(updated.renewalExpiresAt).toBeUndefined();
  });

  it('清除续期码状态', () => {
    const state: OfflineGraceState = {
      deployId: 'deploy-001',
      firstOfflineAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
      lastOnlineAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
      graceExpiresAt: Date.now() + 20 * 24 * 60 * 60 * 1000,
      readOnly: false,
      renewalExpiresAt: Date.now() + 5 * 24 * 60 * 60 * 1000,
    };

    const updated = updateOnlineStatus(state);
    expect(updated.renewalExpiresAt).toBeUndefined();
    expect(updated.readOnly).toBe(false);
  });

  it('保留 deployId', () => {
    const state = initOfflineGrace('my-deploy-id');
    const updated = updateOnlineStatus(state);
    expect(updated.deployId).toBe('my-deploy-id');
  });
});

describe('checkGraceStatus', () => {
  it('宽限期内返回 inGracePeriod: true, readOnly: false', () => {
    const state: OfflineGraceState = {
      deployId: 'deploy-001',
      firstOfflineAt: Date.now() - 5 * 24 * 60 * 60 * 1000, // 5 天前
      lastOnlineAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
      graceExpiresAt: Date.now() + 25 * 24 * 60 * 60 * 1000, // 还有 25 天
      readOnly: false,
    };

    const result = checkGraceStatus(state);
    expect(result.inGracePeriod).toBe(true);
    expect(result.readOnly).toBe(false);
    expect(result.daysRemaining).toBeGreaterThan(0);
  });

  it('宽限期过期后进入只读模式', () => {
    const state: OfflineGraceState = {
      deployId: 'deploy-001',
      firstOfflineAt: Date.now() - 35 * 24 * 60 * 60 * 1000, // 35 天前
      lastOnlineAt: Date.now() - 35 * 24 * 60 * 60 * 1000,
      graceExpiresAt: Date.now() - 5 * 24 * 60 * 60 * 1000, // 已过期 5 天
      readOnly: false,
    };

    const result = checkGraceStatus(state);
    expect(result.inGracePeriod).toBe(false);
    expect(result.readOnly).toBe(true);
    expect(result.daysRemaining).toBe(0);
  });

  it('续期码有效时返回续期码剩余天数', () => {
    const state: OfflineGraceState = {
      deployId: 'deploy-001',
      firstOfflineAt: Date.now() - 35 * 24 * 60 * 60 * 1000,
      lastOnlineAt: Date.now() - 35 * 24 * 60 * 60 * 1000,
      graceExpiresAt: Date.now() - 5 * 24 * 60 * 60 * 1000, // 宽限期已过
      readOnly: true,
      renewalExpiresAt: Date.now() + 3 * 24 * 60 * 60 * 1000, // 续期码还有 3 天
    };

    const result = checkGraceStatus(state);
    expect(result.inGracePeriod).toBe(true);
    expect(result.readOnly).toBe(false);
    expect(result.daysRemaining).toBe(3);
  });

  it('续期码过期后回到只读模式', () => {
    const state: OfflineGraceState = {
      deployId: 'deploy-001',
      firstOfflineAt: Date.now() - 40 * 24 * 60 * 60 * 1000,
      lastOnlineAt: Date.now() - 40 * 24 * 60 * 60 * 1000,
      graceExpiresAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
      readOnly: true,
      renewalExpiresAt: Date.now() - 1 * 24 * 60 * 60 * 1000, // 续期码已过期
    };

    const result = checkGraceStatus(state);
    expect(result.inGracePeriod).toBe(false);
    expect(result.readOnly).toBe(true);
    expect(result.daysRemaining).toBe(0);
  });

  it('daysRemaining 向上取整', () => {
    const state: OfflineGraceState = {
      deployId: 'deploy-001',
      firstOfflineAt: Date.now(),
      lastOnlineAt: Date.now(),
      graceExpiresAt: Date.now() + 1.5 * 24 * 60 * 60 * 1000, // 1.5 天
      readOnly: false,
    };

    const result = checkGraceStatus(state);
    expect(result.daysRemaining).toBe(2); // ceil(1.5) = 2
  });
});

describe('generateRenewalCode / verifyRenewalCode', () => {
  const secret = 'test-renewal-secret-key-12345';

  it('生成并验证续期码', () => {
    const code = generateRenewalCode('deploy-001', secret);
    expect(typeof code).toBe('string');
    expect(code.length).toBeGreaterThan(0);

    const result = verifyRenewalCode(code, 'deploy-001', secret);
    expect(result.valid).toBe(true);
    expect(result.expiresAt).toBeGreaterThan(Date.now());
    expect(result.error).toBeUndefined();
  });

  it('续期码有效期约 7 天', () => {
    const before = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const code = generateRenewalCode('deploy-001', secret);
    const after = Date.now() + 7 * 24 * 60 * 60 * 1000;

    const result = verifyRenewalCode(code, 'deploy-001', secret);
    expect(result.valid).toBe(true);
    expect(result.expiresAt!).toBeGreaterThanOrEqual(before - 1000);
    expect(result.expiresAt!).toBeLessThanOrEqual(after + 1000);
  });

  it('错误的 deployId 验证失败', () => {
    const code = generateRenewalCode('deploy-001', secret);
    const result = verifyRenewalCode(code, 'deploy-002', secret);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('deploy_id_mismatch');
  });

  it('错误的 secret 验证失败', () => {
    const code = generateRenewalCode('deploy-001', secret);
    const result = verifyRenewalCode(code, 'deploy-001', 'wrong-secret');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('invalid_signature');
  });

  it('畸形续期码返回 malformed', () => {
    const result = verifyRenewalCode('not-valid-base64!!!', 'deploy-001', secret);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('malformed');
  });

  it('篡改续期码内容验证失败', () => {
    const code = generateRenewalCode('deploy-001', secret);
    // 解码后篡改 expiresAt
    const decoded = JSON.parse(Buffer.from(code, 'base64url').toString('utf8'));
    decoded.expiresAt = Date.now() + 365 * 24 * 60 * 60 * 1000; // 改为 1 年后
    const tampered = Buffer.from(JSON.stringify(decoded)).toString('base64url');

    const result = verifyRenewalCode(tampered, 'deploy-001', secret);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('invalid_signature');
  });

  it('不同 deployId 生成不同续期码', () => {
    const code1 = generateRenewalCode('deploy-001', secret);
    const code2 = generateRenewalCode('deploy-002', secret);
    expect(code1).not.toBe(code2);
  });
});
