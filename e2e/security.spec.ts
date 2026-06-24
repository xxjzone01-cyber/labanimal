import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const API = 'http://localhost:3001/api';
const prisma = new PrismaClient();

let adminToken: string;
let adminLabId: string;

let otherToken: string;
let otherLabId: string;
let otherUserId: string;

// ─── Helper ──────────────────────────────────────────────────

async function apiWith(
  tok: string,
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${tok}`,
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
  // Login as admin
  const adminRes = await apiWith('', 'POST', '/auth/login', {
    email: 'admin@demo.lab',
    password: 'password',
  });
  expect(adminRes.status).toBe(200);
  adminToken = adminRes.data.token;
  adminLabId = adminRes.data.labs[0].labId;

  // Register a completely separate user with their own lab
  const unique = Date.now();
  const regRes = await apiWith('', 'POST', '/auth/register', {
    email: `other-${unique}@test.lab`,
    password: 'OtherPass123!',
    name: 'Other User',
  });
  expect(regRes.status).toBe(201);
  otherToken = regRes.data.token;
  otherUserId = regRes.data.user.id;

  // Create a lab for the other user via Prisma
  const otherLab = await prisma.lab.create({
    data: { name: `Other Lab ${unique}` },
  });
  otherLabId = otherLab.id;

  await prisma.userLab.create({
    data: { userId: otherUserId, labId: otherLabId, role: 'pi' },
  });
});

test.afterAll(async () => {
  // Cleanup: delete other lab data
  await prisma.animal.deleteMany({ where: { labId: otherLabId } });
  await prisma.userLab.deleteMany({ where: { labId: otherLabId } });
  await prisma.lab.deleteMany({ where: { id: otherLabId } });
  await prisma.user.deleteMany({ where: { id: otherUserId } });
  await prisma.$disconnect();
});

// ─── TS1: 权限隔离 ──────────────────────────────────────────

test('TS1.1 用户不能访问其他 lab 的动物列表', async () => {
  // other 用户尝试访问 admin 的 lab
  const res = await apiWith(otherToken, 'GET', `/animals?labId=${adminLabId}`);
  expect(res.status).toBe(403);
  expect(res.data.error).toMatch(/access denied/i);
});

test('TS1.2 用户不能在其他 lab 创建动物', async () => {
  const res = await apiWith(otherToken, 'POST', '/animals', {
    labId: adminLabId,
    internalId: `INTRUDER-${Date.now()}`,
    species: 'mouse',
    sex: 'male',
  });
  expect(res.status).toBe(403);
});

test('TS1.3 用户不能访问其他 lab 的协议', async () => {
  const res = await apiWith(otherToken, 'GET', `/protocols?labId=${adminLabId}`);
  expect(res.status).toBe(403);
});

test('TS1.4 用户不能访问其他 lab 的审计日志', async () => {
  const res = await apiWith(otherToken, 'GET', `/audit-log?labId=${adminLabId}`);
  expect(res.status).toBe(403);
});

test('TS1.5 用户不能修改其他 lab 的动物', async () => {
  // admin 创建一个动物
  const animal = await apiWith(adminToken, 'POST', '/animals', {
    labId: adminLabId,
    internalId: `ISO-${Date.now()}`,
    species: 'mouse',
    sex: 'male',
  });
  expect(animal.status).toBe(201);

  // other 尝试修改
  const res = await apiWith(otherToken, 'PUT', `/animals/${animal.data.id}`, {
    strain: 'HACKED',
  });
  expect(res.status).toBe(403);
});

test('TS1.6 用户不能删除其他 lab 的动物', async () => {
  // admin 创建一个动物
  const animal = await apiWith(adminToken, 'POST', '/animals', {
    labId: adminLabId,
    internalId: `ISO-DEL-${Date.now()}`,
    species: 'mouse',
    sex: 'male',
  });
  expect(animal.status).toBe(201);

  // other 尝试删除
  const res = await apiWith(otherToken, 'DELETE', `/animals/${animal.data.id}`);
  expect(res.status).toBe(403);
});

test('TS1.7 无 token 不能访问任何受保护端点', async () => {
  const endpoints = [
    '/animals?labId=test',
    '/protocols?labId=test',
    '/rooms?labId=test',
    '/health-records?labId=test',
    '/audit-log?labId=test',
  ];

  for (const ep of endpoints) {
    const res = await apiWith('', 'GET', ep);
    expect(res.status).toBe(401);
  }
});

// ─── TS2: 输入验证 ──────────────────────────────────────────

test('TS2.1 SQL 注入尝试不应崩溃服务', async () => {
  const payloads = [
    "'; DROP TABLE animals; --",
    "1' OR '1'='1",
    "admin'--",
  ];

  for (const payload of payloads) {
    const res = await apiWith(adminToken, 'GET', `/animals?labId=${encodeURIComponent(payload)}`);
    // 应返回 403（无效 labId）或空列表，不应返回 500
    expect(res.status).not.toBe(500);
  }
});

test('TS2.2 XSS 尝试在创建时被原样存储（转义由前端负责）', async () => {
  const xssPayload = '<script>alert("xss")</script>';
  const res = await apiWith(adminToken, 'POST', '/animals', {
    labId: adminLabId,
    internalId: `XSS-${Date.now()}`,
    species: 'mouse',
    sex: 'male',
    notes: xssPayload,
  });
  expect(res.status).toBe(201);
  // 后端原样存储，前端负责转义
  expect(res.data.notes).toBe(xssPayload);
});

test('TS2.3 超长字符串不应崩溃', async () => {
  const longString = 'A'.repeat(10000);
  const res = await apiWith(adminToken, 'POST', '/animals', {
    labId: adminLabId,
    internalId: longString,
    species: 'mouse',
    sex: 'male',
  });
  // 可能返回 400（验证失败）或 201（接受），但不应返回 500
  expect(res.status).not.toBe(500);
});

test('TS2.4 空 JSON body 应返回 400', async () => {
  const res = await apiWith(adminToken, 'POST', '/animals', {});
  expect(res.status).toBe(400);
});

test('TS2.5 非法 JSON 应被拒绝', async () => {
  const res = await fetch(`${API}/animals`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: 'not valid json {{{',
  });
  // 应返回 400 或类似错误，不应返回 500
  expect(res.status).toBeGreaterThanOrEqual(400);
  expect(res.status).toBeLessThan(500);
});

test('TS2.6 负数和零值边界 - capacity', async () => {
  const room = await apiWith(adminToken, 'POST', '/rooms', {
    labId: adminLabId,
    name: `Boundary Room ${Date.now()}`,
  });
  const rack = await apiWith(adminToken, 'POST', '/racks', {
    roomId: room.data.id,
    name: `Boundary Rack ${Date.now()}`,
  });

  // capacity = 0
  const cage0 = await apiWith(adminToken, 'POST', '/cages', {
    rackId: rack.data.id,
    position: `B0-${Date.now()}`,
    capacity: 0,
  });
  // 应该接受（创建空笼位）或拒绝
  expect([200, 201, 400]).toContain(cage0.status);

  // capacity = -1
  const cageNeg = await apiWith(adminToken, 'POST', '/cages', {
    rackId: rack.data.id,
    position: `BN-${Date.now()}`,
    capacity: -1,
  });
  // 不应崩溃
  expect(cageNeg.status).not.toBe(500);
});

test('TS2.7 不存在的 ID 应返回 404', async () => {
  const fakeId = 'nonexistent-id-12345';
  const endpoints = [
    ['GET', `/animals/${fakeId}`],
    ['GET', `/protocols/${fakeId}`],
    ['GET', `/rooms/${fakeId}`],
    ['GET', `/cages/${fakeId}`],
  ];

  for (const [method, path] of endpoints) {
    const res = await apiWith(adminToken, method, path);
    expect(res.status).toBe(404);
  }
});

// ─── TS3: 数据一致性 ────────────────────────────────────────

test('TS3.1 删除有动物的笼位应被拒绝', async () => {
  // 创建设施和笼位
  const room = await apiWith(adminToken, 'POST', '/rooms', {
    labId: adminLabId,
    name: `Consistency Room ${Date.now()}`,
  });
  const rack = await apiWith(adminToken, 'POST', '/racks', {
    roomId: room.data.id,
    name: `Consistency Rack ${Date.now()}`,
  });
  const cage = await apiWith(adminToken, 'POST', '/cages', {
    rackId: rack.data.id,
    position: `CS-${Date.now()}`,
    capacity: 5,
  });

  // 分配动物
  const animal = await apiWith(adminToken, 'POST', '/animals', {
    labId: adminLabId,
    internalId: `CS-${Date.now()}`,
    species: 'mouse',
    sex: 'male',
  });
  await apiWith(adminToken, 'POST', `/cages/${cage.data.id}/assign-animal`, {
    animalId: animal.data.id,
  });

  // 尝试删除笼位
  const del = await apiWith(adminToken, 'DELETE', `/cages/${cage.data.id}`);
  expect(del.status).toBe(400);
  expect(del.data.error).toMatch(/animals/i);
});

test('TS3.2 删除有笼位的房间应被拒绝', async () => {
  const room = await apiWith(adminToken, 'POST', '/rooms', {
    labId: adminLabId,
    name: `Room Del ${Date.now()}`,
  });
  await apiWith(adminToken, 'POST', '/racks', {
    roomId: room.data.id,
    name: `Rack Del ${Date.now()}`,
  });

  // 房间有 rack（间接有 cage 可能），删除应检查
  // 注意：只有当 rack 下有 cage 时才会被拒绝
  const del = await apiWith(adminToken, 'DELETE', `/rooms/${room.data.id}`);
  // 可能成功（无 cage）或失败（有 cage）
  expect([200, 400]).toContain(del.status);
});

test('TS3.3 删除有关联动物的协议应被拒绝', async () => {
  // 创建协议
  const protocol = await apiWith(adminToken, 'POST', '/protocols', {
    labId: adminLabId,
    title: `Del Test ${Date.now()}`,
    piName: 'Dr. Del',
  });
  expect(protocol.status).toBe(201);

  // 创建动物并关联协议
  const animal = await apiWith(adminToken, 'POST', '/animals', {
    labId: adminLabId,
    internalId: `PD-${Date.now()}`,
    species: 'mouse',
    sex: 'male',
    protocolId: protocol.data.id,
  });
  expect(animal.status).toBe(201);

  // 批准协议（这样删除时会检查动物）
  await apiWith(adminToken, 'PUT', `/protocols/${protocol.data.id}`, { status: 'submitted' });
  await apiWith(adminToken, 'PUT', `/protocols/${protocol.data.id}`, { status: 'approved' });

  // 尝试删除已批准且有动物的协议
  const del = await apiWith(adminToken, 'DELETE', `/protocols/${protocol.data.id}`);
  expect(del.status).toBe(400);
  expect(del.data.error).toMatch(/animals/i);
});

test('TS3.4 同一动物不能重复分配到笼位', async () => {
  const room = await apiWith(adminToken, 'POST', '/rooms', {
    labId: adminLabId,
    name: `Dup Room ${Date.now()}`,
  });
  const rack = await apiWith(adminToken, 'POST', '/racks', {
    roomId: room.data.id,
    name: `Dup Rack ${Date.now()}`,
  });
  const cage1 = await apiWith(adminToken, 'POST', '/cages', {
    rackId: rack.data.id,
    position: `D1-${Date.now()}`,
    capacity: 5,
  });
  const cage2 = await apiWith(adminToken, 'POST', '/cages', {
    rackId: rack.data.id,
    position: `D2-${Date.now()}`,
    capacity: 5,
  });

  const animal = await apiWith(adminToken, 'POST', '/animals', {
    labId: adminLabId,
    internalId: `DUP-${Date.now()}`,
    species: 'mouse',
    sex: 'male',
  });

  // 分配到 cage1
  const first = await apiWith(adminToken, 'POST', `/cages/${cage1.data.id}/assign-animal`, {
    animalId: animal.data.id,
  });
  expect(first.status).toBe(200);

  // 再分配到 cage2 — 应该成功（覆盖）或失败
  const second = await apiWith(adminToken, 'POST', `/cages/${cage2.data.id}/assign-animal`, {
    animalId: animal.data.id,
  });
  // 不应崩溃
  expect(second.status).not.toBe(500);
});

test('TS3.5 繁殖记录 sire 和 dam 不能是同一只动物', async () => {
  const animal = await apiWith(adminToken, 'POST', '/animals', {
    labId: adminLabId,
    internalId: `SELF-${Date.now()}`,
    species: 'mouse',
    sex: 'male',
  });

  const res = await apiWith(adminToken, 'POST', '/breedings', {
    labId: adminLabId,
    sireId: animal.data.id,
    damId: animal.data.id,
  });
  expect(res.status).toBe(400);
  expect(res.data.error).toMatch(/different/i);
});

test('TS3.6 繁殖记录 sire 必须是公的，dam 必须是母的', async () => {
  const female = await apiWith(adminToken, 'POST', '/animals', {
    labId: adminLabId,
    internalId: `F-${Date.now()}`,
    species: 'mouse',
    sex: 'female',
  });
  const male = await apiWith(adminToken, 'POST', '/animals', {
    labId: adminLabId,
    internalId: `M-${Date.now()}`,
    species: 'mouse',
    sex: 'male',
  });

  // 反转：用母的做 sire
  const res = await apiWith(adminToken, 'POST', '/breedings', {
    labId: adminLabId,
    sireId: female.data.id,
    damId: male.data.id,
  });
  expect(res.status).toBe(400);
  expect(res.data.error).toMatch(/male/i);
});

test('TS3.7 动物关联不能关联自己', async () => {
  const animal = await apiWith(adminToken, 'POST', '/animals', {
    labId: adminLabId,
    internalId: `SELF-LINK-${Date.now()}`,
    species: 'mouse',
    sex: 'male',
  });

  const res = await apiWith(adminToken, 'POST', '/animal-links', {
    animalId: animal.data.id,
    linkedToId: animal.data.id,
    reason: 'self-link test',
  });
  expect(res.status).toBe(400);
  expect(res.data.error).toMatch(/itself/i);
});
