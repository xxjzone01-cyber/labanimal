import { describe, test, expect, beforeAll } from 'vitest';
import { api, loginAsAdmin, getLabId, createTestAnimal } from './helper';

describe('T6. 死亡报告模块', () => {
  beforeAll(async () => {
    await loginAsAdmin();
  });

  test('T6.1 创建死亡报告', async () => {
    const animal = await createTestAnimal();
    const res = await api('POST', '/death-reports', {
      animalId: animal.id,
      labId: getLabId(),
      dateOfDeath: new Date().toISOString(),
      cause: 'natural',
      notes: 'Found deceased during morning check',
    });
    expect(res.status).toBe(201);
    expect(res.data.id).toBeTruthy();

    // 验证动物状态已更新为 deceased
    const animalRes = await api('GET', `/animals/${animal.id}`);
    expect(animalRes.data.status).toBe('deceased');
  });

  test('T6.2 创建缺必填字段', async () => {
    const res = await api('POST', '/death-reports', {
      animalId: 'some-id',
      // 缺 labId, dateOfDeath, cause
    });
    expect(res.status).toBe(400);
  });

  test('T6.3 列出死亡报告', async () => {
    const res = await api('GET', `/death-reports?labId=${getLabId()}`);
    expect(res.status).toBe(200);
    expect(res.data.items).toBeInstanceOf(Array);
  });

  test('T6.4 更新死亡报告', async () => {
    const animal = await createTestAnimal();
    const create = await api('POST', '/death-reports', {
      animalId: animal.id,
      labId: getLabId(),
      dateOfDeath: new Date().toISOString(),
      cause: 'natural',
    });
    const id = create.data.id;

    const res = await api('PUT', `/death-reports/${id}`, {
      necropsyPerformed: true,
      necropsyFindings: 'No abnormal findings',
    });
    expect(res.status).toBe(200);
    expect(res.data.necropsyPerformed).toBe(true);
  });

  test('T6.5 删除死亡报告', async () => {
    const animal = await createTestAnimal();
    const create = await api('POST', '/death-reports', {
      animalId: animal.id,
      labId: getLabId(),
      dateOfDeath: new Date().toISOString(),
      cause: 'euthanasia',
      euthanasiaMethodId: 'co2_gradual', // AVMA 合规方法
    });
    const id = create.data.id;

    const res = await api('DELETE', `/death-reports/${id}`);
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
  });
});
