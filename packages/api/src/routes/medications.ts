import { Hono } from 'hono';
import { prisma } from '../lib/db.js';
import { authMiddleware, getUser } from '../middleware/auth.js';

const medications = new Hono();

medications.use('*', authMiddleware);

// GET /api/medications — list medications
medications.get('/', async (c) => {
  const user = getUser(c);
  const labId = c.req.query('labId');
  const animalId = c.req.query('animalId');
  const activeOnly = c.req.query('activeOnly');

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
  if (activeOnly === 'true') {
    where.endDate = null;
  }

  const [items, total] = await Promise.all([
    prisma.medication.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        animal: { select: { id: true, internalId: true, species: true } },
      },
      orderBy: { startDate: 'desc' },
    }),
    prisma.medication.count({ where }),
  ]);

  return c.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
});

// POST /api/medications — create medication
medications.post('/', async (c) => {
  const user = getUser(c);
  const body = await c.req.json<{
    animalId: string;
    name: string;
    dosage: string;
    route: string;
    frequency: string;
    startDate: string;
    endDate?: string;
    reason?: string;
    prescribedBy?: string;
    administeredBy?: string;
    outcome?: string;
    notes?: string;
  }>();

  if (!body.animalId || !body.name || !body.dosage || !body.route || !body.frequency || !body.startDate) {
    return c.json({ error: 'animalId, name, dosage, route, frequency, and startDate are required' }, 400);
  }

  // Verify animal exists and user has access
  const animal = await prisma.animal.findUnique({
    where: { id: body.animalId },
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

  const medication = await prisma.medication.create({
    data: {
      animalId: body.animalId,
      labId: animal.labId,
      name: body.name,
      dosage: body.dosage,
      route: body.route,
      frequency: body.frequency,
      startDate: new Date(body.startDate),
      endDate: body.endDate ? new Date(body.endDate) : null,
      reason: body.reason,
      prescribedBy: body.prescribedBy,
      administeredBy: body.administeredBy,
      outcome: body.outcome,
      notes: body.notes,
    },
    include: {
      animal: { select: { id: true, internalId: true, species: true } },
    },
  });

  return c.json(medication, 201);
});

// GET /api/medications/:id — get medication detail
medications.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);

  const medication = await prisma.medication.findUnique({
    where: { id },
    include: {
      animal: { select: { id: true, internalId: true, species: true, labId: true } },
    },
  });

  if (!medication) {
    return c.json({ error: 'Medication not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: medication.animal.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  return c.json(medication);
});

// PUT /api/medications/:id — update medication
medications.put('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);
  const body = await c.req.json<Record<string, unknown>>();

  const existing = await prisma.medication.findUnique({
    where: { id },
    include: { animal: { select: { labId: true } } },
  });
  if (!existing) {
    return c.json({ error: 'Medication not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: existing.animal.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const medication = await prisma.medication.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name as string }),
      ...(body.dosage !== undefined && { dosage: body.dosage as string }),
      ...(body.route !== undefined && { route: body.route as string }),
      ...(body.frequency !== undefined && { frequency: body.frequency as string }),
      ...(body.startDate !== undefined && { startDate: new Date(body.startDate as string) }),
      ...(body.endDate !== undefined && { endDate: body.endDate ? new Date(body.endDate as string) : null }),
      ...(body.reason !== undefined && { reason: body.reason as string }),
      ...(body.prescribedBy !== undefined && { prescribedBy: body.prescribedBy as string }),
      ...(body.administeredBy !== undefined && { administeredBy: body.administeredBy as string }),
      ...(body.outcome !== undefined && { outcome: body.outcome as string }),
      ...(body.notes !== undefined && { notes: body.notes as string }),
    },
    include: {
      animal: { select: { id: true, internalId: true, species: true } },
    },
  });

  return c.json(medication);
});

// DELETE /api/medications/:id — delete medication
medications.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);

  const medication = await prisma.medication.findUnique({
    where: { id },
    include: { animal: { select: { labId: true } } },
  });
  if (!medication) {
    return c.json({ error: 'Medication not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: medication.animal.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  await prisma.medication.delete({ where: { id } });

  return c.json({ success: true });
});

export { medications };
