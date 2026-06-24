import { Hono } from 'hono';
import { prisma } from '../lib/db.js';
import { authMiddleware, getUser } from '../middleware/auth.js';

const batchSessions = new Hono();

batchSessions.use('*', authMiddleware);

// GET /api/batch-sessions — list batch sessions
batchSessions.get('/', async (c) => {
  const user = getUser(c);
  const labId = c.req.query('labId');
  const materialType = c.req.query('materialType');

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

  const where: Record<string, unknown> = { labId };
  if (materialType) where.materialType = materialType;

  const [items, total] = await Promise.all([
    prisma.batchSession.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.batchSession.count({ where }),
  ]);

  return c.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
});

// POST /api/batch-sessions — create batch session
batchSessions.post('/', async (c) => {
  const user = getUser(c);
  const body = await c.req.json<{
    labId: string;
    batchNumber: string;
    materialType: string;
    supplier?: string;
    receivedDate?: string;
    expirationDate?: string;
    quantity?: number;
    unit?: string;
    storageLocation?: string;
    notes?: string;
  }>();

  if (!body.labId || !body.batchNumber || !body.materialType) {
    return c.json({ error: 'labId, batchNumber, and materialType are required' }, 400);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: body.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const batch = await prisma.batchSession.create({
    data: {
      labId: body.labId,
      batchNumber: body.batchNumber,
      materialType: body.materialType,
      supplier: body.supplier,
      receivedDate: body.receivedDate ? new Date(body.receivedDate) : null,
      expirationDate: body.expirationDate ? new Date(body.expirationDate) : null,
      quantity: body.quantity,
      unit: body.unit,
      storageLocation: body.storageLocation,
      notes: body.notes,
    },
  });

  return c.json(batch, 201);
});

// GET /api/batch-sessions/:id — get batch session detail
batchSessions.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);

  const batch = await prisma.batchSession.findUnique({ where: { id } });
  if (!batch) {
    return c.json({ error: 'Batch session not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: batch.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  return c.json(batch);
});

// PUT /api/batch-sessions/:id — update batch session
batchSessions.put('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);
  const body = await c.req.json<Record<string, unknown>>();

  const existing = await prisma.batchSession.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: 'Batch session not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: existing.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const batch = await prisma.batchSession.update({
    where: { id },
    data: {
      ...(body.batchNumber !== undefined && { batchNumber: body.batchNumber as string }),
      ...(body.materialType !== undefined && { materialType: body.materialType as string }),
      ...(body.supplier !== undefined && { supplier: body.supplier as string }),
      ...(body.receivedDate !== undefined && { receivedDate: body.receivedDate ? new Date(body.receivedDate as string) : null }),
      ...(body.expirationDate !== undefined && { expirationDate: body.expirationDate ? new Date(body.expirationDate as string) : null }),
      ...(body.quantity !== undefined && { quantity: body.quantity as number }),
      ...(body.unit !== undefined && { unit: body.unit as string }),
      ...(body.storageLocation !== undefined && { storageLocation: body.storageLocation as string }),
      ...(body.notes !== undefined && { notes: body.notes as string }),
    },
  });

  return c.json(batch);
});

// DELETE /api/batch-sessions/:id — delete batch session
batchSessions.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);

  const existing = await prisma.batchSession.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: 'Batch session not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: existing.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  await prisma.batchSession.delete({ where: { id } });

  return c.json({ success: true });
});

export { batchSessions };
