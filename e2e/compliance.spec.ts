import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const API = 'http://localhost:3001/api';
const prisma = new PrismaClient();

let token: string;
let labId: string;

// ─── Helper ──────────────────────────────────────────────────

async function api(
  method: string,
  path: string,
  body?: Record<string, unknown>
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

// ─── Setup: login + get labId ────────────────────────────────

test.beforeAll(async () => {
  const res = await api('POST', '/auth/login', {
    email: 'admin@demo.lab',
    password: 'password',
  });
  expect(res.status).toBe(200);
  expect(res.data.token).toBeTruthy();
  token = res.data.token;

  // Get labId directly from database
  const lab = await prisma.lab.findFirst();
  expect(lab).toBeTruthy();
  labId = lab!.id;
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

// ─── Test 1: 登录验证 ────────────────────────────────────────

test('1. Login — admin@demo.lab / password succeeds', async () => {
  const res = await api('POST', '/auth/login', {
    email: 'admin@demo.lab',
    password: 'password',
  });
  expect(res.status).toBe(200);
  expect(res.data.user.email).toBe('admin@demo.lab');
  expect(res.data.user.name).toBe('Dr. Jane Smith');
  expect(res.data.token).toBeTruthy();
});

test('1b. Login — wrong password rejected', async () => {
  const res = await api('POST', '/auth/login', {
    email: 'admin@demo.lab',
    password: 'wrongpassword',
  });
  expect(res.status).toBe(401);
  expect(res.data.error).toMatch(/invalid/i);
});

// ─── Test 2: 超密度笼位 — 第 6 只小鼠被阻止 ─────────────────

test('2. Cage density — 5th mouse blocked (Guide: max 4 for 25g mice)', async () => {
  // Create a fresh room + rack + cage for this test
  const room = await api('POST', '/rooms', {
    labId,
    name: `Density Test Room ${Date.now()}`,
  });
  expect(room.status).toBe(201);

  const rack = await api('POST', '/racks', {
    roomId: room.data.id,
    name: `Density Rack ${Date.now()}`,
  });
  expect(rack.status).toBe(201);

  const cage = await api('POST', '/cages', {
    rackId: rack.data.id,
    position: `DEN-${Date.now()}`,
    capacity: 5,
  });
  expect(cage.status).toBe(201);
  const cageId = cage.data.id;

  // Guide standard: 25g mice → max 4 per cage
  // Create and assign 4 mice (should all succeed)
  for (let i = 1; i <= 4; i++) {
    const animal = await api('POST', '/animals', {
      labId,
      internalId: `DEN-M-${Date.now()}-${i}`,
      species: 'mouse',
      strain: 'C57BL/6J',
      sex: i <= 2 ? 'male' : 'female',
    });
    expect(animal.status).toBe(201);

    const assign = await api('POST', `/cages/${cageId}/assign-animal`, {
      animalId: animal.data.id,
    });
    expect(assign.status).toBe(200);
  }

  // Verify cage has 4 animals
  const cageDetail = await api('GET', `/cages/${cageId}`);
  expect(cageDetail.data.animals.length).toBe(4);

  // 5th animal — creation OK, but assignment blocked by Guide density limit
  const animal5 = await api('POST', '/animals', {
    labId,
    internalId: `DEN-M-${Date.now()}-5`,
    species: 'mouse',
    strain: 'C57BL/6J',
    sex: 'female',
  });
  expect(animal5.status).toBe(201);

  const blocked = await api('POST', `/cages/${cageId}/assign-animal`, {
    animalId: animal5.data.id,
  });
  expect(blocked.status).toBe(400);
  expect(blocked.data.error).toMatch(/density|capacity/i);
});

// ─── Test 3: 检疫阻断 — 未放行动物不能分配笼位 ───────────────

test('3. Quarantine — quarantined animal blocked from cage assignment', async () => {
  // Find an existing quarantined animal (search all pages)
  let quarantined: any = null;
  let page = 1;
  while (!quarantined) {
    const animals = await api('GET', `/animals?labId=${labId}&page=${page}&limit=50`);
    if (!animals.data.items || animals.data.items.length === 0) break;
    quarantined = animals.data.items.find(
      (a: any) => a.quarantineStatus === 'quarantined'
    );
    if (!quarantined && animals.data.items.length < 50) break;
    page++;
  }

  // If no quarantined animal exists, create one
  if (!quarantined) {
    const created = await api('POST', '/animals', {
      labId,
      internalId: `Q-TEST-${Date.now()}`,
      species: 'mouse',
      sex: 'male',
      strain: 'C57BL/6J',
    });
    expect(created.status).toBe(201);
    // Set quarantine via Prisma
    await prisma.animal.update({
      where: { id: created.data.id },
      data: {
        quarantineStatus: 'quarantined',
        quarantineUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
    quarantined = (await api('GET', `/animals/${created.data.id}`)).data;
  }
  expect(quarantined).toBeTruthy();

  // Create a fresh cage to assign to
  const room = await api('POST', '/rooms', {
    labId,
    name: `Quarantine Test Room ${Date.now()}`,
  });
  expect(room.status).toBe(201);

  const rack = await api('POST', '/racks', {
    roomId: room.data.id,
    name: `Q Rack ${Date.now()}`,
  });
  expect(rack.status).toBe(201);

  const cage = await api('POST', '/cages', {
    rackId: rack.data.id,
    position: `QC-${Date.now()}`,
    capacity: 5,
  });
  expect(cage.status).toBe(201);

  // Try to assign quarantined animal — should be blocked
  const blocked = await api('POST', `/cages/${cage.data.id}/assign-animal`, {
    animalId: quarantined.id,
  });
  expect(blocked.status).toBe(403);
  expect(blocked.data.error).toMatch(/quarantine/i);
});

// ─── Test 4: 身份弃用 — 搜索 M-001 导向 M-999 ────────────────

test('4. Identity deprecation — retired animal links to active replacement', async () => {
  // Find or create a retired→active link scenario
  let retiredAnimal: any = null;
  let activeAnimal: any = null;

  // Search for existing retired animal with links
  let page = 1;
  while (!retiredAnimal && page <= 10) {
    const animals = await api('GET', `/animals?labId=${labId}&page=${page}&limit=50`);
    if (!animals.data.items || animals.data.items.length === 0) break;
    retiredAnimal = animals.data.items.find(
      (a: any) => a.status === 'retired' && a.identityLinks && a.identityLinks.length > 0
    );
    if (retiredAnimal) {
      activeAnimal = retiredAnimal.identityLinks[0]?.linkedTo;
    }
    if (!retiredAnimal && animals.data.items.length < 50) break;
    page++;
  }

  // If no existing scenario, create one
  if (!retiredAnimal) {
    const old = await api('POST', '/animals', {
      labId,
      internalId: `OLD-${Date.now()}`,
      species: 'mouse',
      sex: 'male',
      strain: 'C57BL/6J',
    });
    const replacement = await api('POST', '/animals', {
      labId,
      internalId: `NEW-${Date.now()}`,
      species: 'mouse',
      sex: 'male',
      strain: 'C57BL/6J',
    });
    expect(old.status).toBe(201);
    expect(replacement.status).toBe(201);

    // Create link (retires old animal)
    const link = await api('POST', '/animal-links', {
      animalId: old.data.id,
      linkedToId: replacement.data.id,
      reason: 'ear_tag_fell_off',
    });
    expect(link.status).toBe(201);

    retiredAnimal = (await api('GET', `/animals/${old.data.id}`)).data;
    activeAnimal = (await api('GET', `/animals/${replacement.data.id}`)).data;
  }

  expect(retiredAnimal).toBeTruthy();
  expect(activeAnimal).toBeTruthy();

  // Verify old animal is retired
  expect(retiredAnimal.status).toBe('retired');

  // Verify replacement is active
  expect(activeAnimal.status).toBe('active');

  // Check animal-links
  const links = await api('GET', `/animal-links?labId=${labId}&animalId=${retiredAnimal.id}`);
  expect(links.status).toBe(200);
  expect(links.data.length).toBeGreaterThan(0);
  expect(links.data[0].linkedToId).toBe(activeAnimal.id);
});

// ─── Test 5: AVMA 阻断 — 兔 + CO2 安乐死被拒绝 ──────────────

test('5. AVMA block — rabbit + CO2 euthanasia rejected', async () => {
  // Find or create a rabbit
  let rabbit: any = null;
  let page = 1;
  while (!rabbit && page <= 10) {
    const animals = await api('GET', `/animals?labId=${labId}&species=rabbit&page=${page}&limit=50`);
    if (!animals.data.items || animals.data.items.length === 0) break;
    rabbit = animals.data.items.find((a: any) => a.species === 'rabbit' && a.status === 'active');
    if (!rabbit && animals.data.items.length < 50) break;
    page++;
  }

  // If no rabbit exists, create one
  if (!rabbit) {
    const created = await api('POST', '/animals', {
      labId,
      internalId: `R-TEST-${Date.now()}`,
      species: 'rabbit',
      sex: 'female',
      strain: 'New Zealand White',
    });
    expect(created.status).toBe(201);
    rabbit = created.data;
  }
  expect(rabbit).toBeTruthy();

  // Attempt euthanasia with CO2 (unacceptable for rabbits per AVMA)
  const res = await api('POST', '/health-records', {
    animalId: rabbit.id,
    recordType: 'euthanasia',
    euthanasiaMethodId: 'co2_gradual',
    description: 'Attempting CO2 euthanasia on rabbit — should be blocked',
  });

  expect(res.status).toBe(400);
  expect(res.data.error).toMatch(/AVMA|unacceptable|violation/i);
  // Should suggest acceptable alternatives
  expect(res.data.suggestedMethods).toBeTruthy();
  expect(res.data.suggestedMethods.length).toBeGreaterThan(0);
});
