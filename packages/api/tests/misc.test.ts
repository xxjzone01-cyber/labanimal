import { describe, test, expect, beforeAll } from 'vitest';
import { api, loginAsAdmin, getLabId, createTestAnimal, createTestInfra } from './helper';

describe('T13. 其他模块', () => {
  beforeAll(async () => {
    await loginAsAdmin();
  });

  // --- Medications ---
  test('T13.1 创建药物记录', async () => {
    const animal = await createTestAnimal();
    const res = await api('POST', '/medications', {
      animalId: animal.id,
      name: 'Buprenorphine',
      dosage: '0.05 mg/kg',
      route: 'subcutaneous',
      frequency: 'every 12 hours',
      startDate: '2025-01-01',
      reason: 'Post-surgical pain management',
    });
    expect(res.status).toBe(201);
    expect(res.data.id).toBeTruthy();
    expect(res.data.name).toBe('Buprenorphine');
  });

  test('T13.2 列出药物记录', async () => {
    const res = await api('GET', `/medications?labId=${getLabId()}`);
    expect(res.status).toBe(200);
    expect(res.data.items).toBeInstanceOf(Array);
  });

  // --- Animal Identifiers ---
  test('T13.3 创建动物标识', async () => {
    const animal = await createTestAnimal();
    const res = await api('POST', '/animal-identifiers', {
      animalId: animal.id,
      type: 'ear_tag',
      value: `TAG-${Date.now()}`,
    });
    expect(res.status).toBe(201);
    expect(res.data.id).toBeTruthy();
    expect(res.data.type).toBe('ear_tag');
    // 第一个标识应自动设为 primary
    expect(res.data.isPrimary).toBe(true);
  });

  test('T13.4 列出动物标识', async () => {
    const animal = await createTestAnimal();
    const res = await api('GET', `/animal-identifiers?labId=${getLabId()}`);
    expect(res.status).toBe(200);
    expect(res.data).toBeInstanceOf(Array);
  });

  // --- Enrichments ---
  test('T13.5 创建丰容记录', async () => {
    const infra = await createTestInfra();
    const res = await api('POST', '/enrichments', {
      cageId: infra.cageId,
      type: 'nesting-material',
      description: 'Paper nesting material',
    });
    expect(res.status).toBe(201);
    expect(res.data.id).toBeTruthy();
    expect(res.data.type).toBe('nesting-material');
  });

  test('T13.6 列出丰容记录', async () => {
    const infra = await createTestInfra();
    const res = await api('GET', `/enrichments?cageId=${infra.cageId}`);
    expect(res.status).toBe(200);
    expect(res.data).toBeInstanceOf(Array);
  });

  // --- Trainings ---
  test('T13.7 创建培训记录', async () => {
    // 获取当前用户 ID（通过登录）
    const loginRes = await api('POST', '/auth/login', {
      email: 'admin@demo.lab',
      password: 'password',
    });
    const userId = loginRes.data.user.id;

    const res = await api('POST', '/trainings', {
      userId,
      labId: getLabId(),
      type: 'iACUC',
      certificationNumber: `CERT-${Date.now()}`,
      issuedBy: 'University IACUC',
      issuedDate: '2024-01-01',
      expirationDate: '2027-01-01',
    });
    expect(res.status).toBe(201);
    expect(res.data.id).toBeTruthy();
    expect(res.data.type).toBe('iACUC');
  });

  test('T13.8 列出培训记录', async () => {
    const res = await api('GET', `/trainings?labId=${getLabId()}`);
    expect(res.status).toBe(200);
    expect(res.data.items).toBeInstanceOf(Array);
  });

  // --- Batch Sessions ---
  test('T13.9 列出批次会话', async () => {
    const res = await api('GET', `/batch-sessions?labId=${getLabId()}`);
    expect(res.status).toBe(200);
    expect(res.data.items).toBeInstanceOf(Array);
  });
});
