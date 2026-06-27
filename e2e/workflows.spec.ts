import { test, expect } from '@playwright/test';
import { createPrismaClient } from '@labanimal/db';

const API = 'http://localhost:3001/api';
const prisma = createPrismaClient();

let token: string;
let labId: string;

// ─── Helper ──────────────────────────────────────────────────

async function api(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

// ─── Setup ───────────────────────────────────────────────────

test.beforeAll(async () => {
  const res = await api('POST', '/auth/login', {
    email: 'admin@demo.lab',
    password: 'password',
  });
  expect(res.status).toBe(200);
  token = res.data.token;

  const lab = await prisma.lab.findFirst();
  expect(lab).toBeTruthy();
  labId = lab!.id;
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

// ─── TE1: 协议生命周期 ──────────────────────────────────────

test('TE1. Protocol lifecycle: draft → submitted → approved → expired', async () => {
  // 创建协议 (draft)
  const create = await api('POST', '/protocols', {
    labId,
    title: `Lifecycle Protocol ${Date.now()}`,
    piName: 'Dr. Lifecycle',
    painCategory: 'B',
    threeRsReplacement: 'Used computational models',
    hasStatisticalJustification: true,
    usesAnalgesics: true,
    hasHumaneEndpoints: true,
  });
  expect(create.status).toBe(201);
  expect(create.data.status).toBe('draft');
  const protocolId = create.data.id;

  // draft → submitted
  const submit = await api('PUT', `/protocols/${protocolId}`, { status: 'submitted' });
  expect(submit.status).toBe(200);
  expect(submit.data.status).toBe('submitted');
  expect(submit.data.submittedAt).toBeTruthy();

  // submitted → approved
  const approve = await api('PUT', `/protocols/${protocolId}`, { status: 'approved' });
  expect(approve.status).toBe(200);
  expect(approve.data.status).toBe('approved');
  expect(approve.data.approvedAt).toBeTruthy();

  // approved → expired
  const expire = await api('PUT', `/protocols/${protocolId}`, { status: 'expired' });
  expect(expire.status).toBe(200);
  expect(expire.data.status).toBe('expired');

  // 无效转换: expired → submitted 应失败
  const invalid = await api('PUT', `/protocols/${protocolId}`, { status: 'submitted' });
  expect(invalid.status).toBe(400);
  expect(invalid.data.error).toMatch(/invalid status transition/i);

  // 验证 3R 合规检查
  const validation = await api('POST', `/protocols/${protocolId}/validate`);
  expect(validation.status).toBe(200);
  expect(validation.data.valid).toBeDefined();

  // 清理: 删除协议
  const del = await api('DELETE', `/protocols/${protocolId}`);
  expect(del.status).toBe(200);
});

// ─── TE2: 动物生命周期 ──────────────────────────────────────

test('TE2. Animal lifecycle: create → cage → health record → death report', async () => {
  // 创建动物
  const animalRes = await api('POST', '/animals', {
    labId,
    internalId: `LIFE-${Date.now()}`,
    species: 'mouse',
    sex: 'female',
    strain: 'BALB/c',
  });
  expect(animalRes.status).toBe(201);
  expect(animalRes.data.status).toBe('active');
  const animalId = animalRes.data.id;

  // 创建设施并分配笼位
  const room = await api('POST', '/rooms', { labId, name: `Life Room ${Date.now()}` });
  const rack = await api('POST', '/racks', {
    roomId: room.data.id,
    name: `Life Rack ${Date.now()}`,
  });
  const cage = await api('POST', '/cages', {
    rackId: rack.data.id,
    position: `L-${Date.now()}`,
    capacity: 5,
  });
  expect(cage.status).toBe(201);

  const assign = await api('POST', `/cages/${cage.data.id}/assign-animal`, { animalId });
  expect(assign.status).toBe(200);

  // 验证动物已分配到笼位
  const animalDetail = await api('GET', `/animals/${animalId}`);
  expect(animalDetail.data.cageId).toBe(cage.data.id);

  // 创建健康记录
  const health = await api('POST', '/health-records', {
    animalId,
    recordType: 'observation',
    weight: 21.5,
    bodyConditionScore: 3,
    description: 'Healthy, normal weight',
  });
  expect(health.status).toBe(201);

  // 创建第二条健康记录 (体重下降)
  const health2 = await api('POST', '/health-records', {
    animalId,
    recordType: 'observation',
    weight: 18.2,
    bodyConditionScore: 2,
    painScore: 2,
    painScoreType: 'mouse_grimace',
    description: 'Weight loss, mild pain indicators',
    treatment: 'Buprenorphine 0.05mg/kg SC',
  });
  expect(health2.status).toBe(201);

  // 验证健康记录列表
  const records = await api('GET', `/health-records?labId=${labId}&animalId=${animalId}`);
  expect(records.status).toBe(200);
  expect(records.data.items.length).toBe(2);

  // 创建死亡报告 (自然死亡)
  const death = await api('POST', '/death-reports', {
    animalId,
    labId,
    dateOfDeath: new Date().toISOString(),
    cause: 'natural',
    necropsyPerformed: true,
    necropsyFindings: 'Tumor found in abdominal cavity',
  });
  expect(death.status).toBe(201);

  // 验证动物状态变为 deceased
  const finalAnimal = await api('GET', `/animals/${animalId}`);
  expect(finalAnimal.data.status).toBe('deceased');
});

// ─── TE3: 检疫工作流 ────────────────────────────────────────

test('TE3. Quarantine workflow: create quarantined → block cage → release → assign', async () => {
  // 创建动物，然后通过 Prisma 设置检疫状态
  const animalRes = await api('POST', '/animals', {
    labId,
    internalId: `Q-${Date.now()}`,
    species: 'mouse',
    sex: 'male',
    strain: 'C57BL/6J',
  });
  expect(animalRes.status).toBe(201);
  const animalId = animalRes.data.id;

  // 通过 Prisma 设置检疫状态（API 不接受 quarantineStatus 参数）
  await prisma.animal.update({
    where: { id: animalId },
    data: {
      quarantineStatus: 'quarantined',
      quarantineUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  // 创建设施
  const room = await api('POST', '/rooms', { labId, name: `Q Room ${Date.now()}` });
  const rack = await api('POST', '/racks', { roomId: room.data.id, name: `Q Rack ${Date.now()}` });
  const cage = await api('POST', '/cages', {
    rackId: rack.data.id,
    position: `QC-${Date.now()}`,
    capacity: 5,
  });

  // 尝试分配检疫动物到普通笼位 — 应被阻断
  const blocked = await api('POST', `/cages/${cage.data.id}/assign-animal`, { animalId });
  expect(blocked.status).toBe(403);
  expect(blocked.data.error).toMatch(/quarantine/i);

  // 释放检疫
  const release = await api('POST', `/animals/${animalId}/release-quarantine`);
  expect(release.status).toBe(200);

  // 再次分配 — 应成功
  const assign = await api('POST', `/cages/${cage.data.id}/assign-animal`, { animalId });
  expect(assign.status).toBe(200);

  // 验证动物状态
  const finalAnimal = await api('GET', `/animals/${animalId}`);
  expect(finalAnimal.data.quarantineStatus).toBe('released');
  expect(finalAnimal.data.cageId).toBe(cage.data.id);
});

// ─── TE4: 繁殖流程 ──────────────────────────────────────────

test('TE4. Breeding flow: pair → litter → wean', async () => {
  // 创建公鼠和母鼠
  const sire = await api('POST', '/animals', {
    labId,
    internalId: `SIRE-${Date.now()}`,
    species: 'mouse',
    sex: 'male',
    strain: 'C57BL/6J',
  });
  const dam = await api('POST', '/animals', {
    labId,
    internalId: `DAM-${Date.now()}`,
    species: 'mouse',
    sex: 'female',
    strain: 'C57BL/6J',
  });
  expect(sire.status).toBe(201);
  expect(dam.status).toBe(201);

  // 创建繁殖记录
  const breeding = await api('POST', '/breedings', {
    labId,
    sireId: sire.data.id,
    damId: dam.data.id,
    pairDate: '2025-06-01',
  });
  expect(breeding.status).toBe(201);
  expect(breeding.data.sireId).toBe(sire.data.id);
  const breedingId = breeding.data.id;

  // 更新: 记录产仔
  const litter = await api('PUT', `/breedings/${breedingId}`, {
    litterDate: '2025-06-22',
    litterSize: 7,
  });
  expect(litter.status).toBe(200);
  expect(litter.data.litterSize).toBe(7);

  // 断奶
  const wean = await api('POST', `/breedings/${breedingId}/wean`, {
    weanedCount: 6,
    weaningDate: '2025-07-13',
  });
  expect(wean.status).toBe(200);
  expect(wean.data.success).toBe(true);
  expect(wean.data.breeding.weanedCount).toBe(6);

  // 重复断奶应失败
  const weanAgain = await api('POST', `/breedings/${breedingId}/wean`, {
    weanedCount: 6,
  });
  expect(weanAgain.status).toBe(400);
  expect(weanAgain.data.error).toMatch(/already weaned/i);
});

// ─── TE5: 审计 + 签名 ──────────────────────────────────────

test('TE5. Audit + Signature: protocol → sign → verify hash chain', async () => {
  // 创建协议
  const protocol = await api('POST', '/protocols', {
    labId,
    title: `Audit Test Protocol ${Date.now()}`,
    piName: 'Dr. Audit',
  });
  expect(protocol.status).toBe(201);
  const protocolId = protocol.data.id;

  // 提交并批准
  await api('PUT', `/protocols/${protocolId}`, { status: 'submitted' });
  await api('PUT', `/protocols/${protocolId}`, { status: 'approved' });

  // 电子签名
  const sig = await api('POST', '/electronic-signatures', {
    protocolId,
    entityType: 'protocol',
    entityId: protocolId,
    meaning: 'approved',
    reasonForSigning: 'Protocol review complete, all 3R requirements met',
  });
  expect(sig.status).toBe(201);
  expect(sig.data.signatureHash).toBeTruthy();
  expect(sig.data.printedName).toBeTruthy();
  const sigId = sig.data.id;

  // 验证签名完整性
  const verify = await api('GET', `/electronic-signatures/${sigId}/verify`);
  expect(verify.status).toBe(200);
  expect(verify.data.valid).toBe(true);
  expect(verify.data.computedHash).toBe(verify.data.storedHash);

  // 创建审计日志
  const audit = await api('POST', '/audit-log', {
    labId,
    entityType: 'protocol',
    entityId: protocolId,
    action: 'status_change',
    diff: { from: 'submitted', to: 'approved' },
  });
  expect(audit.status).toBe(201);
  expect(audit.data.hash).toBeTruthy();
  expect(audit.data.previousHash).toBeTruthy();

  // 验证哈希链
  const chainVerify = await api('GET', `/audit-log/verify?labId=${labId}`);
  expect(chainVerify.status).toBe(200);
  expect(chainVerify.data.totalEntries).toBeGreaterThan(0);
  expect(typeof chainVerify.data.valid).toBe('boolean');
});

// ─── TE6: 药物 + 丰容工作流 ─────────────────────────────────

test('TE6. Medication + Enrichment workflow', async () => {
  // 创建动物
  const animal = await api('POST', '/animals', {
    labId,
    internalId: `MED-${Date.now()}`,
    species: 'mouse',
    sex: 'male',
    strain: 'C57BL/6J',
  });
  expect(animal.status).toBe(201);

  // 创建设施和笼位
  const room = await api('POST', '/rooms', { labId, name: `Med Room ${Date.now()}` });
  const rack = await api('POST', '/racks', {
    roomId: room.data.id,
    name: `Med Rack ${Date.now()}`,
  });
  const cage = await api('POST', '/cages', {
    rackId: rack.data.id,
    position: `M-${Date.now()}`,
    capacity: 5,
  });
  await api('POST', `/cages/${cage.data.id}/assign-animal`, { animalId: animal.data.id });

  // 创建药物记录
  const med = await api('POST', '/medications', {
    animalId: animal.data.id,
    name: 'Buprenorphine SR',
    dosage: '0.05 mg/kg',
    route: 'subcutaneous',
    frequency: 'every 12 hours',
    startDate: '2025-06-01',
    reason: 'Post-operative pain management',
    prescribedBy: 'Dr. Vet',
  });
  expect(med.status).toBe(201);
  const medId = med.data.id;

  // 更新药物: 添加结束日期和结果
  const medUpdate = await api('PUT', `/medications/${medId}`, {
    endDate: '2025-06-04',
    outcome: 'Full recovery, pain resolved',
  });
  expect(medUpdate.status).toBe(200);
  expect(medUpdate.data.outcome).toBe('Full recovery, pain resolved');

  // 验证药物列表
  const medList = await api('GET', `/medications?labId=${labId}&animalId=${animal.data.id}`);
  expect(medList.status).toBe(200);
  expect(medList.data.items.length).toBeGreaterThan(0);

  // 创建丰容记录
  const enrich = await api('POST', '/enrichments', {
    cageId: cage.data.id,
    type: 'nesting-material',
    description: 'Nestlets and paper strips',
  });
  expect(enrich.status).toBe(201);
  const enrichId = enrich.data.id;

  // 添加第二种丰容
  const enrich2 = await api('POST', '/enrichments', {
    cageId: cage.data.id,
    type: 'shelter',
    description: 'Small plastic igloo shelter',
  });
  expect(enrich2.status).toBe(201);

  // 验证丰容列表
  const enrichList = await api('GET', `/enrichments?cageId=${cage.data.id}`);
  expect(enrichList.status).toBe(200);
  expect(enrichList.data.length).toBe(2);

  // 移除一种丰容
  const removeEnrich = await api('PUT', `/enrichments/${enrichId}`, {
    removedDate: new Date().toISOString(),
  });
  expect(removeEnrich.status).toBe(200);

  // 验证活跃丰容只剩 1 个
  const activeList = await api('GET', `/enrichments?cageId=${cage.data.id}&activeOnly=true`);
  expect(activeList.status).toBe(200);
  expect(activeList.data.length).toBe(1);
});

// ─── TE7: 计费工作流 ────────────────────────────────────────

test('TE7. Billing workflow: rates → animals → generate bill', async () => {
  // 创建费率
  const rate1 = await api('POST', '/rates', {
    labId,
    species: 'mouse',
    dailyRate: 1.5,
    cageRate: 0.75,
  });
  expect(rate1.status).toBe(201);

  const rate2 = await api('POST', '/rates', {
    labId,
    species: 'rat',
    dailyRate: 3.0,
    cageRate: 1.5,
  });
  expect(rate2.status).toBe(201);

  // 验证费率列表
  const rateList = await api('GET', `/rates?labId=${labId}`);
  expect(rateList.status).toBe(200);
  expect(rateList.data.length).toBeGreaterThanOrEqual(2);

  // 生成账单 (6月1日到7月1日 = 30天)
  const bill = await api(
    'GET',
    `/billing/generate?labId=${labId}&startDate=2025-06-01&endDate=2025-07-01`,
  );
  expect(bill.status).toBe(200);
  expect(bill.data.period.days).toBe(30);
  expect(bill.data.lineItems).toBeInstanceOf(Array);
  expect(bill.data.summary).toBeDefined();
  expect(typeof bill.data.summary.total).toBe('number');

  // 验证行项目包含物种信息
  if (bill.data.lineItems.length > 0) {
    const item = bill.data.lineItems[0];
    expect(item.type).toMatch(/animal|cage/);
    expect(item.count).toBeGreaterThan(0);
    expect(item.dailyRate).toBeGreaterThan(0);
    expect(item.subtotal).toBeGreaterThanOrEqual(0);
  }
});
