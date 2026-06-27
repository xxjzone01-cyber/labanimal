import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { authMiddleware, getUser } from '../middleware/auth.js';
import { parseBody } from '../middleware/validate.js';
import { sendQuotaAlert } from '../lib/email/send.js';

const createAnimalSchema = z.object({
  labId: z.string().min(1, 'labId is required'),
  internalId: z.string().min(1, 'internalId is required'),
  species: z.string().min(1, 'species is required'),
  sex: z.enum(['male', 'female', 'unknown'], { message: 'sex must be male, female, or unknown' }),
  strain: z.string().optional(),
  genotype: z.string().optional(),
  dateOfBirth: z.string().optional(),
  source: z.string().optional(),
  cageId: z.string().optional(),
  protocolId: z.string().optional(),
  notes: z.string().optional(),
});

const animals = new Hono();

// All animal routes require auth
animals.use('*', authMiddleware);

// GET /api/animals — list animals with filters
animals.get('/', async (c) => {
  const user = getUser(c);
  const labId = c.req.query('labId');
  const species = c.req.query('species');
  const status = c.req.query('status');
  const search = c.req.query('search');
  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100);

  if (!labId) {
    return c.json({ error: 'labId query parameter is required' }, 400);
  }

  // Verify user has access to this lab
  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied to this lab' }, 403);
  }

  const where: Record<string, unknown> = { labId };
  if (species) where.species = species;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { internalId: { contains: search } },
      { strain: { contains: search } },
      { genotype: { contains: search } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.animal.findMany({
      where,
      include: {
        cage: { include: { rack: { include: { room: true } } } },
        identityLinks: {
          include: {
            linkedTo: { select: { id: true, internalId: true, status: true } },
          },
        },
        linkedFrom: {
          include: {
            animal: { select: { id: true, internalId: true, status: true } },
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.animal.count({ where }),
  ]);

  return c.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
});

// POST /api/animals — create animal
animals.post('/', async (c) => {
  const body = parseBody(createAnimalSchema, await c.req.json());

  // 检查用户是否属于目标 lab
  const user = getUser(c);
  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: body.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const animal = await prisma.animal.create({
    data: {
      labId: body.labId,
      internalId: body.internalId,
      species: body.species,
      strain: body.strain,
      genotype: body.genotype,
      sex: body.sex,
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
      source: body.source,
      cageId: body.cageId,
      protocolId: body.protocolId,
      notes: body.notes,
    },
  });

  // fire-and-forget 配额告警检查
  checkQuotaAlert(body.labId).catch(() => {});

  return c.json(animal, 201);
});

// GET /api/animals/:id — get single animal
animals.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);

  const animal = await prisma.animal.findUnique({
    where: { id },
    include: {
      cage: { include: { rack: { include: { room: true } } } },
      protocol: true,
      healthRecords: { orderBy: { recordedAt: 'desc' }, take: 10 },
    },
  });

  if (!animal) {
    return c.json({ error: 'Animal not found' }, 404);
  }

  // 检查用户是否属于该动物所属的 lab
  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: animal.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  return c.json(animal);
});

// PUT /api/animals/:id — update animal
animals.put('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);
  const body = await c.req.json<Record<string, unknown>>();

  // 先查询动物以检查 lab 归属
  const existing = await prisma.animal.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: 'Animal not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: existing.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const animal = await prisma.animal.update({
    where: { id },
    data: {
      ...(body.internalId !== undefined && { internalId: body.internalId as string }),
      ...(body.species !== undefined && { species: body.species as string }),
      ...(body.strain !== undefined && { strain: body.strain as string }),
      ...(body.genotype !== undefined && { genotype: body.genotype as string }),
      ...(body.sex !== undefined && { sex: body.sex as string }),
      ...(body.dateOfBirth !== undefined && {
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth as string) : null,
      }),
      ...(body.source !== undefined && { source: body.source as string }),
      ...(body.cageId !== undefined && { cageId: (body.cageId as string) || null }),
      ...(body.protocolId !== undefined && { protocolId: (body.protocolId as string) || null }),
      ...(body.status !== undefined && { status: body.status as string }),
      ...(body.notes !== undefined && { notes: body.notes as string }),
    },
  });

  return c.json(animal);
});

// DELETE /api/animals/:id — delete animal
animals.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);

  const existing = await prisma.animal.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: 'Animal not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: existing.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  await prisma.animal.delete({ where: { id } });

  return c.json({ success: true });
});

// POST /api/animals/:id/release-quarantine — vet releases animal from quarantine
animals.post('/:id/release-quarantine', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);

  const animal = await prisma.animal.findUnique({ where: { id } });
  if (!animal) {
    return c.json({ error: 'Animal not found' }, 404);
  }

  if (animal.quarantineStatus !== 'quarantined' && animal.quarantineStatus !== 'pending') {
    return c.json({ error: 'Animal is not under quarantine' }, 400);
  }

  // Verify user is a veterinarian
  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: animal.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }
  if (membership.role !== 'veterinarian' && membership.role !== 'pi') {
    return c.json({ error: 'Only veterinarians or PIs can release animals from quarantine' }, 403);
  }

  const updated = await prisma.animal.update({
    where: { id },
    data: {
      quarantineStatus: 'released',
      quarantineUntil: null,
    },
  });

  return c.json({ success: true, animal: updated });
});

/** 配额告警检查（fire-and-forget） */
async function checkQuotaAlert(labId: string): Promise<void> {
  try {
    const [count, sub, lab] = await Promise.all([
      prisma.animal.count({ where: { labId, status: { notIn: ['deceased', 'retired'] } } }),
      prisma.subscription.findFirst({ where: { labId, status: 'active' } }),
      prisma.lab.findUnique({
        where: { id: labId },
        select: {
          name: true,
          users: { where: { role: 'admin' }, include: { user: { select: { email: true, name: true } } } },
        },
      }),
    ]);

    if (!lab) return;

    // 获取套餐限额
    const planLimits: Record<string, number> = {
      'academic-free': 500,
      starter: 1000,
      professional: 15000,
      'enterprise-saas': Infinity,
    };
    const planId = sub?.planId || 'academic-free';
    const limit = planLimits[planId] ?? 500;

    // 80% 阈值告警
    if (count >= limit * 0.8 && count < limit) {
      const admins = (lab as any).users || [];
      for (const m of admins) {
        if (!m.user?.email) continue;
        sendQuotaAlert(m.user.email, {
          userName: m.user.name || 'User',
          labName: lab.name,
          currentCount: count,
          limit,
        });
      }
    }
  } catch (err) {
    console.error('[Quota] Alert check failed:', err);
  }
}

export { animals };
