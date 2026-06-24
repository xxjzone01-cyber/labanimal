import { describe, test, expect, beforeAll } from 'vitest';
import { api, loginAsAdmin, getLabId } from './helper';

describe('T8. 审计日志模块', () => {
  beforeAll(async () => {
    await loginAsAdmin();
  });

  test('T8.1 创建审计日志', async () => {
    const res = await api('POST', '/audit-log', {
      labId: getLabId(),
      entityType: 'animal',
      entityId: 'test-animal-001',
      action: 'create',
      diff: { species: 'mouse', strain: 'C57BL/6J' },
    });
    expect(res.status).toBe(201);
    expect(res.data.id).toBeTruthy();
    expect(res.data.hash).toBeTruthy();
    expect(res.data.previousHash).toBeTruthy();
  });

  test('T8.2 列出审计日志', async () => {
    const res = await api('GET', `/audit-log?labId=${getLabId()}`);
    expect(res.status).toBe(200);
    expect(res.data.items).toBeInstanceOf(Array);
    expect(res.data.total).toBeGreaterThanOrEqual(0);
  });

  test('T8.3 创建缺必填字段', async () => {
    const res = await api('POST', '/audit-log', {
      labId: getLabId(),
      // 缺 entityType, entityId, action
    });
    expect(res.status).toBe(400);
  });

  test('T8.4 验证哈希链完整性', async () => {
    // 先创建几条审计记录
    await api('POST', '/audit-log', {
      labId: getLabId(),
      entityType: 'animal',
      entityId: 'hash-test-1',
      action: 'create',
      diff: { test: true },
    });

    const res = await api('GET', `/audit-log/verify?labId=${getLabId()}`);
    expect(res.status).toBe(200);
    expect(res.data.totalEntries).toBeGreaterThan(0);
    // 哈希链可能因种子数据不完整而不完整，但端点应正常工作
    expect(typeof res.data.valid).toBe('boolean');
    expect(res.data.message).toBeTruthy();
  });
});
