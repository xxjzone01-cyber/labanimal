import { Hono } from 'hono';
import { prisma } from '../lib/db.js';
import { authMiddleware, getUser } from '../middleware/auth.js';
import { validateMethod } from '@labanimal/compliance';

const healthRecords = new Hono();

healthRecords.use('*', authMiddleware);

// GET /api/health-records — list health records
healthRecords.get('/', async (c) => {
  const user = getUser(c);
  const labId = c.req.query('labId');
  const animalId = c.req.query('animalId');
  const recordType = c.req.query('recordType');

  if (!labId) {
    return c.json({ error: 'labId query parameter is required' }, 400);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);

  const where: Record<string, unknown> = {
    animal: { labId },
  };
  if (animalId) where.animalId = animalId;
  if (recordType) where.recordType = recordType;

  const [items, total] = await Promise.all([
    prisma.healthRecord.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        animal: { select: { id: true, internalId: true, species: true } },
        recorder: { select: { id: true, name: true } },
      },
      orderBy: { recordedAt: 'desc' },
    }),
    prisma.healthRecord.count({ where }),
  ]);

  return c.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
});

// POST /api/health-records — create health record
healthRecords.post('/', async (c) => {
  const user = getUser(c);
  const body = await c.req.json<{
    animalId: string;
    recordType: string;
    weight?: number;
    bodyConditionScore?: number;
    painScore?: number;
    painScoreType?: string;
    description?: string;
    treatment?: string;
    euthanasiaMethodId?: string;
  }>();

  if (!body.animalId || !body.recordType) {
    return c.json({ error: 'animalId and recordType are required' }, 400);
  }

  // Verify animal exists and user has access
  const animal = await prisma.animal.findUnique({
    where: { id: body.animalId },
    include: { lab: true },
  });
  if (!animal) {
    return c.json({ error: 'Animal not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: animal.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied to this lab' }, 403);
  }

  // AVMA validation for euthanasia records
  if (body.recordType === 'euthanasia') {
    if (!body.euthanasiaMethodId) {
      return c.json({ error: 'euthanasiaMethodId is required for euthanasia records' }, 400);
    }

    const validation = validateMethod({
      species: animal.species,
      methodId: body.euthanasiaMethodId,
    });

    if (!validation.allowed) {
      return c.json({
        error: 'AVMA violation',
        violations: validation.violations,
        suggestedMethods: validation.suggestedMethods,
      }, 400);
    }
  }

  const record = await prisma.healthRecord.create({
    data: {
      animalId: body.animalId,
      recordType: body.recordType,
      weight: body.weight,
      bodyConditionScore: body.bodyConditionScore,
      painScore: body.painScore,
      painScoreType: body.painScoreType,
      description: body.description,
      treatment: body.treatment,
      euthanasiaMethodId: body.euthanasiaMethodId,
      recordedBy: user.userId,
    },
    include: {
      animal: { select: { id: true, internalId: true, species: true } },
      recorder: { select: { id: true, name: true } },
    },
  });

  return c.json(record, 201);
});

// GET /api/health-records/:id — get health record detail
healthRecords.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);

  const record = await prisma.healthRecord.findUnique({
    where: { id },
    include: {
      animal: { select: { id: true, internalId: true, species: true, labId: true } },
      recorder: { select: { id: true, name: true } },
    },
  });

  if (!record) {
    return c.json({ error: 'Health record not found' }, 404);
  }

  // Verify access
  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: record.animal.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  return c.json(record);
});

// PUT /api/health-records/:id — update health record
healthRecords.put('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);
  const body = await c.req.json<Record<string, unknown>>();

  // Verify record exists and user has access
  const existing = await prisma.healthRecord.findUnique({
    where: { id },
    include: { animal: { select: { labId: true, species: true } } },
  });
  if (!existing) {
    return c.json({ error: 'Health record not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: existing.animal.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  // AVMA validation if updating to euthanasia
  if (body.recordType === 'euthanasia' || (existing.recordType === 'euthanasia' && body.euthanasiaMethodId)) {
    const methodId = (body.euthanasiaMethodId as string) || existing.euthanasiaMethodId;
    if (!methodId) {
      return c.json({ error: 'euthanasiaMethodId is required for euthanasia records' }, 400);
    }

    const validation = validateMethod({
      species: existing.animal.species,
      methodId,
    });

    if (!validation.allowed) {
      return c.json({
        error: 'AVMA violation',
        violations: validation.violations,
        suggestedMethods: validation.suggestedMethods,
      }, 400);
    }
  }

  const record = await prisma.healthRecord.update({
    where: { id },
    data: {
      ...(body.recordType !== undefined && { recordType: body.recordType as string }),
      ...(body.weight !== undefined && { weight: body.weight as number }),
      ...(body.bodyConditionScore !== undefined && { bodyConditionScore: body.bodyConditionScore as number }),
      ...(body.painScore !== undefined && { painScore: body.painScore as number }),
      ...(body.painScoreType !== undefined && { painScoreType: body.painScoreType as string }),
      ...(body.description !== undefined && { description: body.description as string }),
      ...(body.treatment !== undefined && { treatment: body.treatment as string }),
      ...(body.euthanasiaMethodId !== undefined && { euthanasiaMethodId: body.euthanasiaMethodId as string }),
    },
    include: {
      animal: { select: { id: true, internalId: true, species: true } },
      recorder: { select: { id: true, name: true } },
    },
  });

  return c.json(record);
});

// DELETE /api/health-records/:id — delete health record
healthRecords.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);

  const record = await prisma.healthRecord.findUnique({
    where: { id },
    include: { animal: { select: { labId: true } } },
  });
  if (!record) {
    return c.json({ error: 'Health record not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: record.animal.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  await prisma.healthRecord.delete({ where: { id } });

  return c.json({ success: true });
});

export { healthRecords };
