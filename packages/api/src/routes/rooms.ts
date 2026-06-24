import { Hono } from 'hono';
import { prisma } from '../lib/db.js';
import { authMiddleware, getUser } from '../middleware/auth.js';

const rooms = new Hono();

rooms.use('*', authMiddleware);

// GET /api/rooms — list rooms for a lab
rooms.get('/', async (c) => {
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

  const items = await prisma.room.findMany({
    where: { labId },
    include: {
      racks: {
        include: {
          cages: {
            include: { animals: { select: { id: true } } },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  // Compute summary for each room
  const result = items.map((room) => {
    const allCages = room.racks.flatMap((r) => r.cages);
    const occupiedCages = allCages.filter((c) => c.status === 'occupied').length;
    const totalAnimals = allCages.reduce((sum, c) => sum + c.animals.length, 0);

    return {
      id: room.id,
      name: room.name,
      location: room.location,
      building: room.building,
      floor: room.floor,
      temperatureMin: room.temperatureMin,
      temperatureMax: room.temperatureMax,
      humidityMin: room.humidityMin,
      humidityMax: room.humidityMax,
      rackCount: room.racks.length,
      cageCount: allCages.length,
      occupiedCages,
      totalAnimals,
    };
  });

  return c.json(result);
});

// POST /api/rooms — create room
rooms.post('/', async (c) => {
  const body = await c.req.json<{
    labId: string;
    name: string;
    location?: string;
    building?: string;
    floor?: number;
    capacity?: number;
    temperatureMin?: number;
    temperatureMax?: number;
    humidityMin?: number;
    humidityMax?: number;
  }>();

  if (!body.labId || !body.name) {
    return c.json({ error: 'labId and name are required' }, 400);
  }

  const room = await prisma.room.create({
    data: {
      labId: body.labId,
      name: body.name,
      location: body.location,
      building: body.building,
      floor: body.floor,
      capacity: body.capacity,
      temperatureMin: body.temperatureMin,
      temperatureMax: body.temperatureMax,
      humidityMin: body.humidityMin,
      humidityMax: body.humidityMax,
    },
  });

  return c.json(room, 201);
});

// GET /api/rooms/:id — get single room
rooms.get('/:id', async (c) => {
  const user = getUser(c);
  const id = c.req.param('id');

  const room = await prisma.room.findUnique({
    where: { id },
    include: {
      racks: {
        include: {
          cages: {
            include: {
              animals: { select: { id: true, internalId: true, species: true, status: true } },
              enrichments: true,
            },
          },
        },
      },
    },
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

  return c.json(room);
});

// PUT /api/rooms/:id — update room
rooms.put('/:id', async (c) => {
  const user = getUser(c);
  const id = c.req.param('id');
  const body = await c.req.json<{
    name?: string;
    location?: string;
    building?: string;
    floor?: number;
    capacity?: number;
    temperatureMin?: number;
    temperatureMax?: number;
    humidityMin?: number;
    humidityMax?: number;
  }>();

  const existing = await prisma.room.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: 'Room not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: existing.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const room = await prisma.room.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.location !== undefined && { location: body.location }),
      ...(body.building !== undefined && { building: body.building }),
      ...(body.floor !== undefined && { floor: body.floor }),
      ...(body.capacity !== undefined && { capacity: body.capacity }),
      ...(body.temperatureMin !== undefined && { temperatureMin: body.temperatureMin }),
      ...(body.temperatureMax !== undefined && { temperatureMax: body.temperatureMax }),
      ...(body.humidityMin !== undefined && { humidityMin: body.humidityMin }),
      ...(body.humidityMax !== undefined && { humidityMax: body.humidityMax }),
    },
  });

  return c.json(room);
});

// DELETE /api/rooms/:id — delete room
rooms.delete('/:id', async (c) => {
  const user = getUser(c);
  const id = c.req.param('id');

  const existing = await prisma.room.findUnique({
    where: { id },
    include: { racks: { include: { cages: true } } },
  });
  if (!existing) {
    return c.json({ error: 'Room not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: existing.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const totalCages = existing.racks.reduce((sum, r) => sum + r.cages.length, 0);
  if (totalCages > 0) {
    return c.json({ error: 'Cannot delete room with existing cages', cageCount: totalCages }, 400);
  }

  await prisma.room.delete({ where: { id } });

  return c.json({ message: 'Room deleted' });
});

export { rooms };
