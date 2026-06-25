import { Hono } from 'hono';
import { prisma } from '../lib/db.js';
import { authMiddleware, getUser } from '../middleware/auth.js';

const animalIdentifiers = new Hono();

animalIdentifiers.use('*', authMiddleware);

// GET /api/animal-identifiers — list animal identifiers
animalIdentifiers.get('/', async (c) => {
  const user = getUser(c);
  const labId = c.req.query('labId');
  const animalId = c.req.query('animalId');

  if (!labId) {
    return c.json({ error: 'labId query parameter is required' }, 400);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const where: Record<string, unknown> = {
    animal: { labId },
  };
  if (animalId) where.animalId = animalId;

  const items = await prisma.animalIdentifier.findMany({
    where,
    include: {
      animal: { select: { id: true, internalId: true, species: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return c.json(items);
});

// POST /api/animal-identifiers — create animal identifier
animalIdentifiers.post('/', async (c) => {
  const user = getUser(c);
  const body = await c.req.json<{
    animalId: string;
    type: string;
    value: string;
    isPrimary?: boolean;
    notes?: string;
  }>();

  if (!body.animalId || !body.type || !body.value) {
    return c.json({ error: 'animalId, type, and value are required' }, 400);
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

  // Check if this is the first identifier for this animal
  const existingCount = await prisma.animalIdentifier.count({
    where: { animalId: body.animalId },
  });

  // Auto-set as primary if it's the first identifier
  const isPrimary = existingCount === 0 ? true : (body.isPrimary || false);

  try {
    const identifier = await prisma.animalIdentifier.create({
      data: {
        animalId: body.animalId,
        labId: animal.labId,
        type: body.type,
        value: body.value,
        isPrimary,
        notes: body.notes,
      },
      include: {
        animal: { select: { id: true, internalId: true, species: true } },
      },
    });

    return c.json(identifier, 201);
  } catch (error: unknown) {
    // Handle unique constraint violation
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return c.json({
        error: 'Identifier already exists',
        message: `A ${body.type} identifier with value "${body.value}" already exists for this animal`,
      }, 409);
    }
    throw error;
  }
});

// GET /api/animal-identifiers/:id — get identifier detail
animalIdentifiers.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);

  const identifier = await prisma.animalIdentifier.findUnique({
    where: { id },
    include: {
      animal: { select: { id: true, internalId: true, species: true, labId: true } },
    },
  });

  if (!identifier) {
    return c.json({ error: 'Identifier not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: identifier.animal.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  return c.json(identifier);
});

// PUT /api/animal-identifiers/:id — update identifier
animalIdentifiers.put('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);
  const body = await c.req.json<Record<string, unknown>>();

  const existing = await prisma.animalIdentifier.findUnique({
    where: { id },
    include: { animal: { select: { labId: true } } },
  });
  if (!existing) {
    return c.json({ error: 'Identifier not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: existing.animal.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  try {
    const identifier = await prisma.animalIdentifier.update({
      where: { id },
      data: {
        ...(body.type !== undefined && { type: body.type as string }),
        ...(body.value !== undefined && { value: body.value as string }),
        ...(body.isPrimary !== undefined && { isPrimary: body.isPrimary as boolean }),
        ...(body.notes !== undefined && { notes: body.notes as string }),
      },
      include: {
        animal: { select: { id: true, internalId: true, species: true } },
      },
    });

    return c.json(identifier);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return c.json({
        error: 'Identifier already exists',
        message: `A ${body.type} identifier with value "${body.value}" already exists for this animal`,
      }, 409);
    }
    throw error;
  }
});

// DELETE /api/animal-identifiers/:id — delete identifier
animalIdentifiers.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);

  const identifier = await prisma.animalIdentifier.findUnique({
    where: { id },
    include: { animal: { select: { labId: true } } },
  });
  if (!identifier) {
    return c.json({ error: 'Identifier not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: identifier.animal.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  await prisma.animalIdentifier.delete({ where: { id } });

  return c.json({ success: true });
});

export { animalIdentifiers };
