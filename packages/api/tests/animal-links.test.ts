import { describe, test, expect, beforeAll } from 'vitest';
import { api, loginAsAdmin, getLabId, createTestAnimal } from './helper';

describe('T7. 动物关联模块', () => {
  beforeAll(async () => {
    await loginAsAdmin();
  });

  test('T7.1 创建动物关联', async () => {
    const animal1 = await createTestAnimal({ internalId: `LINK-A-${Date.now()}` });
    const animal2 = await createTestAnimal({ internalId: `LINK-B-${Date.now()}` });

    const res = await api('POST', '/animal-links', {
      animalId: animal1.id,
      linkedToId: animal2.id,
      reason: 'Sibling replacement',
    });
    expect(res.status).toBe(201);
    expect(res.data.id).toBeTruthy();
    expect(res.data.animalId).toBe(animal1.id);
    expect(res.data.linkedToId).toBe(animal2.id);

    // 验证原动物状态变为 retired
    const animalRes = await api('GET', `/animals/${animal1.id}`);
    expect(animalRes.data.status).toBe('retired');
  });

  test('T7.2 不能关联自己', async () => {
    const animal = await createTestAnimal();
    const res = await api('POST', '/animal-links', {
      animalId: animal.id,
      linkedToId: animal.id,
      reason: 'Self link attempt',
    });
    expect(res.status).toBe(400);
    expect(res.data.error).toMatch(/itself/i);
  });

  test('T7.3 缺必填字段', async () => {
    const res = await api('POST', '/animal-links', {
      animalId: 'some-id',
      // 缺 linkedToId 和 reason
    });
    expect(res.status).toBe(400);
  });

  test('T7.4 列出动物关联', async () => {
    const res = await api('GET', `/animal-links?labId=${getLabId()}`);
    expect(res.status).toBe(200);
    expect(res.data).toBeInstanceOf(Array);
  });

  test('T7.5 删除关联', async () => {
    const animal1 = await createTestAnimal({ internalId: `DEL-A-${Date.now()}` });
    const animal2 = await createTestAnimal({ internalId: `DEL-B-${Date.now()}` });

    const create = await api('POST', '/animal-links', {
      animalId: animal1.id,
      linkedToId: animal2.id,
      reason: 'Test deletion',
    });
    const id = create.data.id;

    const res = await api('DELETE', `/animal-links/${id}`);
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
  });
});
