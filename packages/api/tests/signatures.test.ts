import { describe, test, expect, beforeAll } from 'vitest';
import { api, loginAsAdmin, getLabId } from './helper';

describe('T9. 电子签名模块', () => {
  let protocolId: string;

  beforeAll(async () => {
    await loginAsAdmin();
    // 创建一个测试协议用于签名
    const res = await api('POST', '/protocols', {
      labId: getLabId(),
      title: `Signature Test Protocol ${Date.now()}`,
      piName: 'Dr. Signer',
    });
    protocolId = res.data.id;
  });

  test('T9.1 创建电子签名', async () => {
    const res = await api('POST', '/electronic-signatures', {
      protocolId,
      entityType: 'protocol',
      entityId: protocolId,
      meaning: 'approved',
      reasonForSigning: 'Protocol review complete',
    });
    expect(res.status).toBe(201);
    expect(res.data.id).toBeTruthy();
    expect(res.data.signatureHash).toBeTruthy();
    expect(res.data.meaning).toBe('approved');
    expect(res.data.printedName).toBeTruthy(); // 默认使用用户姓名
  });

  test('T9.2 创建签名缺必填字段', async () => {
    const res = await api('POST', '/electronic-signatures', {
      entityType: 'protocol',
      // 缺 entityId 和 meaning
    });
    expect(res.status).toBe(400);
  });

  test('T9.3 无效 meaning 值', async () => {
    const res = await api('POST', '/electronic-signatures', {
      entityType: 'protocol',
      entityId: protocolId,
      meaning: 'invalid_meaning',
    });
    expect(res.status).toBe(400);
    expect(res.data.error).toMatch(/meaning/i);
  });

  test('T9.4 验证签名完整性', async () => {
    // 先创建签名
    const create = await api('POST', '/electronic-signatures', {
      protocolId,
      entityType: 'protocol',
      entityId: protocolId,
      meaning: 'reviewed',
    });
    const sigId = create.data.id;

    const res = await api('GET', `/electronic-signatures/${sigId}/verify`);
    expect(res.status).toBe(200);
    expect(res.data.valid).toBe(true);
    expect(res.data.computedHash).toBe(res.data.storedHash);
  });

  test('T9.5 列出签名', async () => {
    const res = await api('GET', `/electronic-signatures?labId=${getLabId()}`);
    expect(res.status).toBe(200);
    expect(res.data.items).toBeInstanceOf(Array);
  });
});
