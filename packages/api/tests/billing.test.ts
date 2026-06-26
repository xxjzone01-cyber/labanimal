import { describe, test, expect, beforeAll } from 'vitest';
import { api, loginAsAdmin, getLabId } from './helper';

describe('T15. 计费模块', () => {
  beforeAll(async () => {
    await loginAsAdmin();
  });

  test('T15.1 获取使用量', async () => {
    const res = await api('GET', `/billing/usage?labId=${getLabId()}`);
    expect(res.status).toBe(200);
    expect(res.data.plan).toBe('academic-free');
    expect(res.data.limits).toBeDefined();
    expect(res.data.limits.maxAnimals).toBe(500);
    expect(res.data.usage).toBeDefined();
    expect(typeof res.data.usage.animalCount).toBe('number');
    expect(typeof res.data.usage.userCount).toBe('number');
    expect(typeof res.data.usage.reportsThisMonth).toBe('number');
    expect(typeof res.data.isOverLimit).toBe('boolean');
    expect(Array.isArray(res.data.overLimitReasons)).toBe(true);
  });

  test('T15.2 获取使用量缺 labId 返回 400', async () => {
    const res = await api('GET', '/billing/usage');
    expect(res.status).toBe(400);
    expect(res.data.error).toMatch(/labId/i);
  });

  test('T15.3 生成账单报告', async () => {
    const res = await api(
      'GET',
      `/billing/generate?labId=${getLabId()}&startDate=2025-01-01&endDate=2025-01-31`,
    );
    expect(res.status).toBe(200);
    expect(res.data.labId).toBe(getLabId());
    expect(res.data.period).toBeDefined();
    expect(res.data.period.days).toBe(30);
    expect(Array.isArray(res.data.lineItems)).toBe(true);
    expect(res.data.summary).toBeDefined();
    expect(typeof res.data.summary.total).toBe('number');
  });

  test('T15.4 生成账单缺参数返回 400', async () => {
    const res = await api('GET', `/billing/generate?labId=${getLabId()}`);
    expect(res.status).toBe(400);
    expect(res.data.error).toMatch(/startDate.*endDate/i);
  });

  test('T15.5 生成账单日期无效返回 400', async () => {
    const res = await api(
      'GET',
      `/billing/generate?labId=${getLabId()}&startDate=2025-01-31&endDate=2025-01-01`,
    );
    expect(res.status).toBe(400);
    expect(res.data.error).toMatch(/endDate must be after/i);
  });

  test('T15.6 无 token 返回 401', async () => {
    const res = await fetch('http://localhost:3001/api/billing/usage?labId=test');
    expect(res.status).toBe(401);
  });
});
