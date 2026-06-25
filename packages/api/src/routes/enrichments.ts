import { Hono } from 'hono';
import { prisma } from '../lib/db.js';
import { authMiddleware, getUser } from '../middleware/auth.js';

const enrichments = new Hono();

enrichments.use('*', authMiddleware);

// GET /api/enrichments — list enrichments
enrichments.get('/', async (c) => {
  const user = getUser(c);
  const cageId = c.req.query('cageId');
  const activeOnly = c.req.query('activeOnly');

  if (!cageId) {
    return c.json({ error: 'cageId query parameter is required' }, 400);
  }

  // Verify cage exists and user has access
  const cage = await prisma.cage.findUnique({
    where: { id: cageId },
    include: { rack: { include: { room: { select: { labId: true } } } } },
  });
  if (!cage) {
    return c.json({ error: 'Cage not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: cage.rack.room.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const where: Record<string, unknown> = { cageId };
  if (activeOnly === 'true') {
    where.removedDate = null;
  }

  const items = await prisma.enrichment.findMany({
    where,
    orderBy: { addedDate: 'desc' },
  });

  return c.json(items);
});

// POST /api/enrichments — create enrichment
enrichments.post('/', async (c) => {
  const user = getUser(c);
  const body = await c.req.json<{
    cageId: string;
    type: string;
    description?: string;
    notes?: string;
  }>();

  if (!body.cageId || !body.type) {
    return c.json({ error: 'cageId and type are required' }, 400);
  }

  // Verify cage exists and user has access
  const cage = await prisma.cage.findUnique({
    where: { id: body.cageId },
    include: { rack: { include: { room: { select: { labId: true } } } } },
  });
  if (!cage) {
    return c.json({ error: 'Cage not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: cage.rack.room.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const enrichment = await prisma.enrichment.create({
    data: {
      cageId: body.cageId,
      labId: cage.rack.room.labId,
      type: body.type,
      description: body.description,
      notes: body.notes,
    },
  });

  return c.json(enrichment, 201);
});

// GET /api/enrichments/:id — get enrichment detail
enrichments.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);

  const enrichment = await prisma.enrichment.findUnique({
    where: { id },
    include: {
      cage: {
        include: {
          rack: { include: { room: { select: { labId: true } } } },
        },
      },
    },
  });

  if (!enrichment) {
    return c.json({ error: 'Enrichment not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: enrichment.cage.rack.room.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  return c.json(enrichment);
});

// PUT /api/enrichments/:id — update enrichment
enrichments.put('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);
  const body = await c.req.json<Record<string, unknown>>();

  const existing = await prisma.enrichment.findUnique({
    where: { id },
    include: {
      cage: {
        include: {
          rack: { include: { room: { select: { labId: true } } } },
        },
      },
    },
  });
  if (!existing) {
    return c.json({ error: 'Enrichment not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: existing.cage.rack.room.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const enrichment = await prisma.enrichment.update({
    where: { id },
    data: {
      ...(body.type !== undefined && { type: body.type as string }),
      ...(body.description !== undefined && { description: body.description as string }),
      ...(body.removedDate !== undefined && {
        removedDate: body.removedDate ? new Date(body.removedDate as string) : null,
      }),
      ...(body.notes !== undefined && { notes: body.notes as string }),
    },
  });

  return c.json(enrichment);
});

// DELETE /api/enrichments/:id — delete enrichment
enrichments.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);

  const enrichment = await prisma.enrichment.findUnique({
    where: { id },
    include: {
      cage: {
        include: {
          rack: { include: { room: { select: { labId: true } } } },
        },
      },
    },
  });
  if (!enrichment) {
    return c.json({ error: 'Enrichment not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: enrichment.cage.rack.room.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  await prisma.enrichment.delete({ where: { id } });

  return c.json({ success: true });
});

export { enrichments };
