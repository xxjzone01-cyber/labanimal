import { describe, test, expect, beforeAll } from 'vitest';
import { api, loginAsAdmin, getLabId, createTestInfra } from './helper';

describe('T3. 设施模块', () => {
  beforeAll(async () => {
    await loginAsAdmin();
  });

  // --- Rooms ---
  test('T3.1 创建房间', async () => {
    const res = await api('POST', '/rooms', {
      labId: getLabId(),
      name: `Test Room ${Date.now()}`,
      location: 'Building A',
    });
    expect(res.status).toBe(201);
    expect(res.data.id).toBeTruthy();
    expect(res.data.name).toContain('Test Room');
  });

  test('T3.2 列出房间', async () => {
    const res = await api('GET', `/rooms?labId=${getLabId()}`);
    expect(res.status).toBe(200);
    expect(res.data).toBeInstanceOf(Array);
    // 返回的房间应包含 rackCount 等摘要字段
    if (res.data.length > 0) {
      expect(res.data[0].rackCount).toBeDefined();
    }
  });

  test('T3.3 创建房间缺字段', async () => {
    const res = await api('POST', '/rooms', { labId: getLabId() });
    expect(res.status).toBe(400);
  });

  // --- Racks ---
  test('T3.4 创建货架', async () => {
    const infra = await createTestInfra();
    // 验证 rack 已创建
    const res = await api('GET', `/racks?roomId=${infra.rackId}`);
    // rackId 是 rack 的 ID，这里用 GET /racks/:id 更准确
    const rackRes = await api('GET', `/racks/${infra.rackId}`);
    expect(rackRes.status).toBe(200);
    expect(rackRes.data.id).toBe(infra.rackId);
  });

  // --- Cages ---
  test('T3.5 创建笼位', async () => {
    const infra = await createTestInfra();
    const cageRes = await api('GET', `/cages/${infra.cageId}`);
    expect(cageRes.status).toBe(200);
    expect(cageRes.data.id).toBe(infra.cageId);
    expect(cageRes.data.capacity).toBe(5);
  });

  test('T3.6 分配动物到笼位', async () => {
    const infra = await createTestInfra();
    const { createTestAnimal } = await import('./helper');
    const animal = await createTestAnimal();

    const res = await api('POST', `/cages/${infra.cageId}/assign-animal`, {
      animalId: animal.id,
    });
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
  });

  test('T3.7 密度超限拒绝分配', async () => {
    const infra = await createTestInfra();
    const { createTestAnimal } = await import('./helper');

    // 25g 小鼠最大密度 = 4 只
    for (let i = 0; i < 4; i++) {
      const a = await createTestAnimal();
      await api('POST', `/cages/${infra.cageId}/assign-animal`, { animalId: a.id });
    }

    // 第 5 只应被拒绝
    const fifth = await createTestAnimal();
    const res = await api('POST', `/cages/${infra.cageId}/assign-animal`, {
      animalId: fifth.id,
    });
    expect(res.status).toBe(400);
    expect(res.data.error).toMatch(/density/i);
  });

  test('T3.8 从笼位移除动物', async () => {
    const infra = await createTestInfra();
    const { createTestAnimal } = await import('./helper');
    const animal = await createTestAnimal();

    await api('POST', `/cages/${infra.cageId}/assign-animal`, { animalId: animal.id });
    const res = await api('POST', `/cages/${infra.cageId}/remove-animal`, {
      animalId: animal.id,
    });
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
  });

  test('T3.9 删除有动物的笼位应失败', async () => {
    const infra = await createTestInfra();
    const { createTestAnimal } = await import('./helper');
    const animal = await createTestAnimal();
    await api('POST', `/cages/${infra.cageId}/assign-animal`, { animalId: animal.id });

    const res = await api('DELETE', `/cages/${infra.cageId}`);
    expect(res.status).toBe(400);
    expect(res.data.error).toMatch(/animals/i);
  });
});
