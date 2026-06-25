import { Hono } from 'hono';
import { prisma } from '../lib/db.js';
import { authMiddleware, getUser } from '../middleware/auth.js';

const breedings = new Hono();

breedings.use('*', authMiddleware);

// GET /api/breedings — list breeding records
breedings.get('/', async (c) => {
  const user = getUser(c);
  const labId = c.req.query('labId');

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

  const [items, total] = await Promise.all([
    prisma.breeding.findMany({
      where: { labId },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        sire: { select: { id: true, internalId: true, species: true } },
        dam: { select: { id: true, internalId: true, species: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.breeding.count({ where: { labId } }),
  ]);

  return c.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
});

// POST /api/breedings — create breeding record
breedings.post('/', async (c) => {
  const user = getUser(c);
  const body = await c.req.json<{
    labId: string;
    sireId: string;
    damId: string;
    pairDate?: string;
    litterDate?: string;
    litterSize?: number;
    weanedCount?: number;
    weaningDate?: string;
    notes?: string;
  }>();

  if (!body.labId || !body.sireId || !body.damId) {
    return c.json({ error: 'labId, sireId, and damId are required' }, 400);
  }

  if (body.sireId === body.damId) {
    return c.json({ error: 'Sire and dam must be different animals' }, 400);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: body.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  // Verify both animals exist and are in the same lab
  const [sire, dam] = await Promise.all([
    prisma.animal.findUnique({ where: { id: body.sireId } }),
    prisma.animal.findUnique({ where: { id: body.damId } }),
  ]);

  if (!sire) {
    return c.json({ error: 'Sire animal not found' }, 404);
  }
  if (!dam) {
    return c.json({ error: 'Dam animal not found' }, 404);
  }

  if (sire.labId !== body.labId || dam.labId !== body.labId) {
    return c.json({ error: 'Both animals must belong to the specified lab' }, 400);
  }

  if (sire.status !== 'active' || dam.status !== 'active') {
    return c.json({ error: 'Both animals must have active status' }, 400);
  }

  if (sire.sex !== 'male') {
    return c.json({ error: 'Sire must be male' }, 400);
  }
  if (dam.sex !== 'female') {
    return c.json({ error: 'Dam must be female' }, 400);
  }

  // Validate dates
  if (body.pairDate && body.litterDate) {
    const pairDate = new Date(body.pairDate);
    const litterDate = new Date(body.litterDate);
    if (litterDate < pairDate) {
      return c.json({ error: 'litterDate must be after pairDate' }, 400);
    }
  }

  const breeding = await prisma.breeding.create({
    data: {
      labId: body.labId,
      sireId: body.sireId,
      damId: body.damId,
      pairDate: body.pairDate ? new Date(body.pairDate) : null,
      litterDate: body.litterDate ? new Date(body.litterDate) : null,
      litterSize: body.litterSize,
      weanedCount: body.weanedCount,
      weaningDate: body.weaningDate ? new Date(body.weaningDate) : null,
      notes: body.notes,
    },
    include: {
      sire: { select: { id: true, internalId: true, species: true } },
      dam: { select: { id: true, internalId: true, species: true } },
    },
  });

  return c.json(breeding, 201);
});

// GET /api/breedings/:id — get breeding detail
breedings.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);

  const breeding = await prisma.breeding.findUnique({
    where: { id },
    include: {
      sire: { select: { id: true, internalId: true, species: true, sex: true } },
      dam: { select: { id: true, internalId: true, species: true, sex: true } },
    },
  });

  if (!breeding) {
    return c.json({ error: 'Breeding record not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: breeding.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  return c.json(breeding);
});

// PUT /api/breedings/:id — update breeding record
breedings.put('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);
  const body = await c.req.json<Record<string, unknown>>();

  const existing = await prisma.breeding.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: 'Breeding record not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: existing.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  // Validate dates if both are provided
  const pairDate = body.pairDate ? new Date(body.pairDate as string) : existing.pairDate;
  const litterDate = body.litterDate ? new Date(body.litterDate as string) : existing.litterDate;
  if (pairDate && litterDate && litterDate < pairDate) {
    return c.json({ error: 'litterDate must be after pairDate' }, 400);
  }

  const breeding = await prisma.breeding.update({
    where: { id },
    data: {
      ...(body.pairDate !== undefined && {
        pairDate: body.pairDate ? new Date(body.pairDate as string) : null,
      }),
      ...(body.litterDate !== undefined && {
        litterDate: body.litterDate ? new Date(body.litterDate as string) : null,
      }),
      ...(body.litterSize !== undefined && { litterSize: body.litterSize as number }),
      ...(body.weanedCount !== undefined && { weanedCount: body.weanedCount as number }),
      ...(body.weaningDate !== undefined && {
        weaningDate: body.weaningDate ? new Date(body.weaningDate as string) : null,
      }),
      ...(body.notes !== undefined && { notes: body.notes as string }),
    },
    include: {
      sire: { select: { id: true, internalId: true, species: true } },
      dam: { select: { id: true, internalId: true, species: true } },
    },
  });

  return c.json(breeding);
});

// POST /api/breedings/:id/wean — mark litter as weaned
breedings.post('/:id/wean', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);
  const body = await c.req.json<{
    weanedCount: number;
    weaningDate?: string;
    pupIds?: string[]; // Optional: animal IDs of pups to assign to cages
  }>();

  const breeding = await prisma.breeding.findUnique({ where: { id } });
  if (!breeding) {
    return c.json({ error: 'Breeding record not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: breeding.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  // Validate: must have a litter first
  if (!breeding.litterDate || !breeding.litterSize) {
    return c.json(
      { error: 'Cannot wean: no litter recorded yet. Record litter date and size first.' },
      400,
    );
  }

  // Validate: not already weaned
  if (breeding.weaningDate) {
    return c.json({ error: 'Litter already weaned', weaningDate: breeding.weaningDate }, 400);
  }

  // Validate weaned count
  if (body.weanedCount < 0 || body.weanedCount > breeding.litterSize) {
    return c.json(
      {
        error: `weanedCount must be between 0 and litterSize (${breeding.litterSize})`,
      },
      400,
    );
  }

  // Default weaning date to now if not provided
  const weaningDate = body.weaningDate ? new Date(body.weaningDate) : new Date();

  // Validate: weaning date must be after litter date
  if (weaningDate < breeding.litterDate) {
    return c.json({ error: 'Weaning date must be after litter date' }, 400);
  }

  // Typical weaning age for mice is 21 days
  const daysSinceLitter = Math.floor(
    (weaningDate.getTime() - breeding.litterDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  const warnings: string[] = [];
  if (daysSinceLitter < 14) {
    warnings.push(
      `Only ${daysSinceLitter} days since litter. Typical minimum weaning age is 14 days (mice).`,
    );
  }

  const updated = await prisma.breeding.update({
    where: { id },
    data: {
      weanedCount: body.weanedCount,
      weaningDate,
    },
    include: {
      sire: { select: { id: true, internalId: true, species: true } },
      dam: { select: { id: true, internalId: true, species: true } },
    },
  });

  return c.json({ success: true, breeding: updated, warnings });
});

// DELETE /api/breedings/:id — delete breeding record
breedings.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);

  const breeding = await prisma.breeding.findUnique({ where: { id } });
  if (!breeding) {
    return c.json({ error: 'Breeding record not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: breeding.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  await prisma.breeding.delete({ where: { id } });

  return c.json({ success: true });
});

export { breedings };
