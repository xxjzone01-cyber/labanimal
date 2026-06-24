import { describe, test, expect, beforeAll } from 'vitest';
import { api, loginAsAdmin, getLabId, createTestAnimal } from './helper';

describe('T10. 繁殖模块', () => {
  let sireId: string;
  let damId: string;

  beforeAll(async () => {
    await loginAsAdmin();
    // 创建一公一母两只动物
    const sire = await createTestAnimal({ sex: 'male', internalId: `SIRE-${Date.now()}` });
    const dam = await createTestAnimal({ sex: 'female', internalId: `DAM-${Date.now()}` });
    sireId = sire.id;
    damId = dam.id;
  });

  test('T10.1 创建繁殖记录', async () => {
    const res = await api('POST', '/breedings', {
      labId: getLabId(),
      sireId,
      damId,
      pairDate: '2025-01-01',
    });
    expect(res.status).toBe(201);
    expect(res.data.id).toBeTruthy();
    expect(res.data.sireId).toBe(sireId);
    expect(res.data.damId).toBe(damId);
  });

  test('T10.2 sire 和 dam 不能相同', async () => {
    const res = await api('POST', '/breedings', {
      labId: getLabId(),
      sireId,
      damId: sireId,
    });
    expect(res.status).toBe(400);
    expect(res.data.error).toMatch(/different/i);
  });

  test('T10.3 sire 必须是公的', async () => {
    // dam 是母的，不能做 sire
    const res = await api('POST', '/breedings', {
      labId: getLabId(),
      sireId: damId, // 母的做 sire
      damId: sireId,
    });
    expect(res.status).toBe(400);
    expect(res.data.error).toMatch(/male/i);
  });

  test('T10.4 列出繁殖记录', async () => {
    const res = await api('GET', `/breedings?labId=${getLabId()}`);
    expect(res.status).toBe(200);
    expect(res.data.items).toBeInstanceOf(Array);
  });

  test('T10.5 更新繁殖记录', async () => {
    const create = await api('POST', '/breedings', {
      labId: getLabId(),
      sireId,
      damId,
    });
    const id = create.data.id;

    const res = await api('PUT', `/breedings/${id}`, {
      litterDate: '2025-02-01',
      litterSize: 6,
    });
    expect(res.status).toBe(200);
    expect(res.data.litterSize).toBe(6);
  });

  test('T10.6 缺必填字段', async () => {
    const res = await api('POST', '/breedings', {
      labId: getLabId(),
      // 缺 sireId, damId
    });
    expect(res.status).toBe(400);
  });

  test('T10.7 删除繁殖记录', async () => {
    const create = await api('POST', '/breedings', {
      labId: getLabId(),
      sireId,
      damId,
    });
    const id = create.data.id;

    const res = await api('DELETE', `/breedings/${id}`);
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
  });
});
