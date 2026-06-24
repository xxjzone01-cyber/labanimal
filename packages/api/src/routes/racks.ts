import { Hono } from 'hono';
import { prisma } from '../lib/db.js';
import { authMiddleware, getUser } from '../middleware/auth.js';

const racks = new Hono();

racks.use('*', authMiddleware);

// GET /api/racks — list racks
racks.get('/', async (c) => {
  const user = getUser(c);
  const roomId = c.req.query('roomId');

  if (!roomId) {
    return c.json({ error: 'roomId query parameter is required' }, 400);
  }

  // Verify room exists and user has access
  const room = await prisma.room.findUnique({
    where: { id: roomId },
  });
  if (!room) {
    return c.json({ error: 'Room not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: room.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const items = await prisma.rack.findMany({
    where: { roomId },
    include: {
      cages: {
        include: {
          animals: { select: { id: true } },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  return c.json(items.map((rack) => ({
    ...rack,
    cageCount: rack.cages.length,
    occupiedCages: rack.cages.filter((c) => c.animals.length > 0).length,
    totalAnimals: rack.cages.reduce((sum, c) => sum + c.animals.length, 0),
    cages: undefined,
  })));
});

// POST /api/racks — create rack
racks.post('/', async (c) => {
  const user = getUser(c);
  const body = await c.req.json<{
    roomId: string;
    name: string;
    layers?: number;
    positionsPerLayer?: number;
  }>();

  if (!body.roomId || !body.name) {
    return c.json({ error: 'roomId and name are required' }, 400);
  }

  // Verify room exists and user has access
  const room = await prisma.room.findUnique({
    where: { id: body.roomId },
  });
  if (!room) {
    return c.json({ error: 'Room not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: room.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const rack = await prisma.rack.create({
    data: {
      roomId: body.roomId,
      name: body.name,
      layers: body.layers,
      positionsPerLayer: body.positionsPerLayer,
    },
  });

  return c.json(rack, 201);
});

// GET /api/racks/:id — get rack detail
racks.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);

  const rack = await prisma.rack.findUnique({
    where: { id },
    include: {
      room: { select: { labId: true } },
      cages: {
        include: {
          animals: { select: { id: true, internalId: true, species: true, status: true } },
        },
      },
    },
  });

  if (!rack) {
    return c.json({ error: 'Rack not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: rack.room.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  return c.json(rack);
});

// PUT /api/racks/:id — update rack
racks.put('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);
  const body = await c.req.json<Record<string, unknown>>();

  const existing = await prisma.rack.findUnique({
    where: { id },
    include: { room: { select: { labId: true } } },
  });
  if (!existing) {
    return c.json({ error: 'Rack not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: existing.room.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const rack = await prisma.rack.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name as string }),
      ...(body.layers !== undefined && { layers: body.layers as number }),
      ...(body.positionsPerLayer !== undefined && { positionsPerLayer: body.positionsPerLayer as number }),
    },
  });

  return c.json(rack);
});

// DELETE /api/racks/:id — delete rack
racks.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);

  const rack = await prisma.rack.findUnique({
    where: { id },
    include: { room: { select: { labId: true } } },
  });
  if (!rack) {
    return c.json({ error: 'Rack not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: rack.room.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  await prisma.rack.delete({ where: { id } });

  return c.json({ success: true });
});

export { racks };
