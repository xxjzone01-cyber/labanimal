import { describe, test, expect, beforeAll } from 'vitest';
import { api, loginAsAdmin, getLabId, createTestAnimal } from './helper';

describe('T5. 健康记录模块', () => {
  beforeAll(async () => {
    await loginAsAdmin();
  });

  test('T5.1 创建健康记录', async () => {
    const animal = await createTestAnimal();
    const res = await api('POST', '/health-records', {
      animalId: animal.id,
      recordType: 'observation',
      weight: 22.5,
      bodyConditionScore: 3,
      description: 'Healthy, normal behavior',
    });
    expect(res.status).toBe(201);
    expect(res.data.id).toBeTruthy();
    expect(res.data.recordType).toBe('observation');
  });

  test('T5.2 创建缺必填字段', async () => {
    const res = await api('POST', '/health-records', {
      animalId: 'some-id',
      // 缺 recordType
    });
    expect(res.status).toBe(400);
  });

  test('T5.3 列出健康记录', async () => {
    const res = await api('GET', `/health-records?labId=${getLabId()}`);
    expect(res.status).toBe(200);
    expect(res.data.items).toBeInstanceOf(Array);
    expect(res.data.page).toBe(1);
  });

  test('T5.4 更新健康记录', async () => {
    const animal = await createTestAnimal();
    const create = await api('POST', '/health-records', {
      animalId: animal.id,
      recordType: 'observation',
      description: 'Initial',
    });
    const id = create.data.id;

    const res = await api('PUT', `/health-records/${id}`, {
      description: 'Updated observation',
      weight: 23.0,
    });
    expect(res.status).toBe(200);
    expect(res.data.description).toBe('Updated observation');
  });

  test('T5.5 删除健康记录', async () => {
    const animal = await createTestAnimal();
    const create = await api('POST', '/health-records', {
      animalId: animal.id,
      recordType: 'observation',
    });
    const id = create.data.id;

    const res = await api('DELETE', `/health-records/${id}`);
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
  });

  test('T5.6 安乐死记录缺方法ID应拒绝', async () => {
    const animal = await createTestAnimal();
    const res = await api('POST', '/health-records', {
      animalId: animal.id,
      recordType: 'euthanasia',
      // 缺 euthanasiaMethodId
    });
    expect(res.status).toBe(400);
    expect(res.data.error).toMatch(/euthanasiaMethodId/i);
  });
});
