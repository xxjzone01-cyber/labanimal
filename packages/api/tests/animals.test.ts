import { describe, test, expect, beforeAll } from 'vitest';
import { api, loginAsAdmin, getLabId, createTestAnimal } from './helper';

describe('T2. 动物模块', () => {
  beforeAll(async () => {
    await loginAsAdmin();
  });

  test('T2.1 创建动物', async () => {
    const animal = await createTestAnimal();
    expect(animal.id).toBeTruthy();
    expect(animal.species).toBe('mouse');
    expect(animal.status).toBe('active');
  });

  test('T2.2 创建缺必填字段', async () => {
    const res = await api('POST', '/animals', {
      labId: getLabId(),
      internalId: 'MISSING-SPECIES',
    });
    expect(res.status).toBe(400);
  });

  test('T2.3 列表分页', async () => {
    const res = await api('GET', `/animals?labId=${getLabId()}&page=1&limit=3`);
    expect(res.status).toBe(200);
    expect(res.data.items).toBeInstanceOf(Array);
    expect(res.data.items.length).toBeLessThanOrEqual(3);
    expect(res.data.page).toBe(1);
    expect(res.data.limit).toBe(3);
  });

  test('T2.4 按物种过滤', async () => {
    const res = await api('GET', `/animals?labId=${getLabId()}&species=mouse`);
    expect(res.status).toBe(200);
    for (const a of res.data.items) {
      expect(a.species).toBe('mouse');
    }
  });

  test('T2.5 搜索', async () => {
    const animal = await createTestAnimal({ internalId: `SEARCH-${Date.now()}` });
    const res = await api('GET', `/animals?labId=${getLabId()}&search=SEARCH-`);
    expect(res.status).toBe(200);
    expect(res.data.items.some((a: any) => a.id === animal.id)).toBe(true);
  });

  test('T2.6 获取详情含关联', async () => {
    const animal = await createTestAnimal();
    const res = await api('GET', `/animals/${animal.id}`);
    expect(res.status).toBe(200);
    expect(res.data.cage !== undefined).toBe(true); // cage field exists
    expect(res.data.protocol !== undefined).toBe(true);
  });

  test('T2.7 更新动物', async () => {
    const animal = await createTestAnimal();
    const res = await api('PUT', `/animals/${animal.id}`, { strain: 'BALB/c' });
    expect(res.status).toBe(200);
    expect(res.data.strain).toBe('BALB/c');
  });

  test('T2.8 删除动物', async () => {
    const animal = await createTestAnimal();
    const res = await api('DELETE', `/animals/${animal.id}`);
    expect(res.status).toBe(200);
    // Verify deleted
    const get = await api('GET', `/animals/${animal.id}`);
    expect(get.status).toBe(404);
  });
});
