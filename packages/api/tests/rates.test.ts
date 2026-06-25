import { describe, test, expect, beforeAll } from 'vitest';
import { api, loginAsAdmin, getLabId } from './helper';

describe('T12. 费率与计费模块', () => {
  beforeAll(async () => {
    await loginAsAdmin();
  });

  test('T12.1 创建费率', async () => {
    const res = await api('POST', '/rates', {
      labId: getLabId(),
      species: 'mouse',
      dailyRate: 1.5,
      cageRate: 0.75,
    });
    expect(res.status).toBe(201);
    expect(res.data.id).toBeTruthy();
    expect(res.data.dailyRate).toBe(1.5);
  });

  test('T12.2 创建缺必填字段', async () => {
    const res = await api('POST', '/rates', {
      labId: getLabId(),
      // 缺 species 和 dailyRate
    });
    expect(res.status).toBe(400);
  });

  test('T12.3 列出费率', async () => {
    const res = await api('GET', `/rates?labId=${getLabId()}`);
    expect(res.status).toBe(200);
    expect(res.data).toBeInstanceOf(Array);
  });

  test('T12.4 更新费率', async () => {
    const create = await api('POST', '/rates', {
      labId: getLabId(),
      species: 'rat',
      dailyRate: 3.0,
    });
    const id = create.data.id;

    const res = await api('PUT', `/rates/${id}`, { dailyRate: 3.5 });
    expect(res.status).toBe(200);
    expect(res.data.dailyRate).toBe(3.5);
  });

  test('T12.5 删除费率', async () => {
    const create = await api('POST', '/rates', {
      labId: getLabId(),
      species: 'rabbit',
      dailyRate: 5.0,
    });
    const id = create.data.id;

    const res = await api('DELETE', `/rates/${id}`);
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
  });

  test('T12.6 生成账单', async () => {
    const res = await api(
      'GET',
      `/billing/generate?labId=${getLabId()}&startDate=2025-01-01&endDate=2025-12-31`,
    );
    expect(res.status).toBe(200);
    expect(res.data.lineItems).toBeInstanceOf(Array);
    expect(res.data.summary).toBeDefined();
  });
});
