import { Hono } from 'hono';
import { prisma } from '../lib/db.js';
import { authMiddleware, getUser } from '../middleware/auth.js';

const rates = new Hono();

rates.use('*', authMiddleware);

// GET /api/rates — list rates
rates.get('/', async (c) => {
  const user = getUser(c);
  const labId = c.req.query('labId');
  const species = c.req.query('species');

  if (!labId) {
    return c.json({ error: 'labId query parameter is required' }, 400);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const where: Record<string, unknown> = { labId };
  if (species) where.species = species;

  const items = await prisma.rate.findMany({
    where,
    orderBy: { effectiveDate: 'desc' },
  });

  return c.json(items);
});

// POST /api/rates — create rate
rates.post('/', async (c) => {
  const user = getUser(c);
  const body = await c.req.json<{
    labId: string;
    species: string;
    dailyRate: number;
    cageRate?: number;
    effectiveDate?: string;
  }>();

  if (!body.labId || !body.species || body.dailyRate === undefined) {
    return c.json({ error: 'labId, species, and dailyRate are required' }, 400);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: body.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const rate = await prisma.rate.create({
    data: {
      labId: body.labId,
      species: body.species,
      dailyRate: body.dailyRate,
      cageRate: body.cageRate,
      effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : null,
    },
  });

  return c.json(rate, 201);
});

// GET /api/rates/:id — get rate detail
rates.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);

  const rate = await prisma.rate.findUnique({ where: { id } });
  if (!rate) {
    return c.json({ error: 'Rate not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: rate.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  return c.json(rate);
});

// PUT /api/rates/:id — update rate
rates.put('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);
  const body = await c.req.json<Record<string, unknown>>();

  const existing = await prisma.rate.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: 'Rate not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: existing.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const rate = await prisma.rate.update({
    where: { id },
    data: {
      ...(body.species !== undefined && { species: body.species as string }),
      ...(body.dailyRate !== undefined && { dailyRate: body.dailyRate as number }),
      ...(body.cageRate !== undefined && { cageRate: body.cageRate as number }),
      ...(body.effectiveDate !== undefined && {
        effectiveDate: body.effectiveDate ? new Date(body.effectiveDate as string) : null,
      }),
    },
  });

  return c.json(rate);
});

// DELETE /api/rates/:id — delete rate
rates.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);

  const rate = await prisma.rate.findUnique({ where: { id } });
  if (!rate) {
    return c.json({ error: 'Rate not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: rate.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  await prisma.rate.delete({ where: { id } });

  return c.json({ success: true });
});

export { rates };
