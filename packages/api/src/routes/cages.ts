import { Hono } from 'hono';
import { prisma } from '../lib/db.js';
import { CageStatus } from '@labanimal/db';
import { authMiddleware, getUser } from '../middleware/auth.js';
import { calculateMaxDensity } from '@labanimal/compliance';

const cages = new Hono();

cages.use('*', authMiddleware);

// GET /api/cages — list cages
cages.get('/', async (c) => {
  const user = getUser(c);
  const rackId = c.req.query('rackId');
  const status = c.req.query('status');

  if (!rackId) {
    return c.json({ error: 'rackId query parameter is required' }, 400);
  }

  // Verify rack exists and user has access
  const rack = await prisma.rack.findUnique({
    where: { id: rackId },
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

  const where: Record<string, unknown> = { rackId };
  if (status) where.status = status;

  const items = await prisma.cage.findMany({
    where,
    include: {
      animals: { select: { id: true, internalId: true, species: true, status: true } },
      enrichments: { where: { removedDate: null }, select: { id: true, type: true } },
    },
    orderBy: { position: 'asc' },
  });

  return c.json(items);
});

// POST /api/cages — create cage
cages.post('/', async (c) => {
  const user = getUser(c);
  const body = await c.req.json<{
    rackId: string;
    position: string;
    status?: string;
    capacity?: number;
    isSingleHoused?: boolean;
    singleHousingReason?: string;
    singleHousingUntil?: string;
  }>();

  if (!body.rackId || !body.position) {
    return c.json({ error: 'rackId and position are required' }, 400);
  }

  // Verify rack exists and user has access
  const rack = await prisma.rack.findUnique({
    where: { id: body.rackId },
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

  const cage = await prisma.cage.create({
    data: {
      rackId: body.rackId,
      labId: rack.room.labId,
      position: body.position,
      status: (body.status || 'empty') as CageStatus,
      capacity: body.capacity || 5,
      isSingleHoused: body.isSingleHoused || false,
      singleHousingReason: body.singleHousingReason,
      singleHousingUntil: body.singleHousingUntil ? new Date(body.singleHousingUntil) : null,
    },
  });

  return c.json(cage, 201);
});

// GET /api/cages/:id — get cage detail
cages.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);

  const cage = await prisma.cage.findUnique({
    where: { id },
    include: {
      rack: {
        include: {
          room: { select: { id: true, name: true, labId: true } },
        },
      },
      animals: { select: { id: true, internalId: true, species: true, status: true } },
      enrichments: { where: { removedDate: null } },
    },
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

  return c.json(cage);
});

// PUT /api/cages/:id — update cage
cages.put('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);
  const body = await c.req.json<Record<string, unknown>>();

  const existing = await prisma.cage.findUnique({
    where: { id },
    include: { rack: { include: { room: { select: { labId: true } } } } },
  });
  if (!existing) {
    return c.json({ error: 'Cage not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: existing.rack.room.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const cage = await prisma.cage.update({
    where: { id },
    data: {
      ...(body.status !== undefined && { status: body.status as CageStatus }),
      ...(body.capacity !== undefined && { capacity: body.capacity as number }),
      ...(body.isSingleHoused !== undefined && { isSingleHoused: body.isSingleHoused as boolean }),
      ...(body.singleHousingReason !== undefined && {
        singleHousingReason: body.singleHousingReason as string,
      }),
      ...(body.singleHousingUntil !== undefined && {
        singleHousingUntil: body.singleHousingUntil
          ? new Date(body.singleHousingUntil as string)
          : null,
      }),
      ...(body.lastCleaned !== undefined && {
        lastCleaned: body.lastCleaned ? new Date(body.lastCleaned as string) : null,
      }),
      ...(body.nextCleaning !== undefined && {
        nextCleaning: body.nextCleaning ? new Date(body.nextCleaning as string) : null,
      }),
    },
  });

  return c.json(cage);
});

// POST /api/cages/:id/assign-animal — assign animal to cage with density check
cages.post('/:id/assign-animal', async (c) => {
  const cageId = c.req.param('id');
  const user = getUser(c);
  const body = await c.req.json<{ animalId: string }>();

  if (!body.animalId) {
    return c.json({ error: 'animalId is required' }, 400);
  }

  const cage = await prisma.cage.findUnique({
    where: { id: cageId },
    include: {
      animals: { select: { id: true } },
      rack: { include: { room: { select: { labId: true } } } },
    },
  });

  if (!cage) {
    return c.json({ error: 'Cage not found' }, 404);
  }

  const animal = await prisma.animal.findUnique({
    where: { id: body.animalId },
    include: { protocol: { select: { densityExemption: true, status: true } } },
  });
  if (!animal) {
    return c.json({ error: 'Animal not found' }, 404);
  }

  // Quarantine block: quarantined animals cannot be assigned to regular cages
  if (animal.quarantineStatus === 'quarantined' || animal.quarantineStatus === 'pending') {
    return c.json(
      {
        error: 'Animal is under quarantine',
        quarantineStatus: animal.quarantineStatus,
        quarantineUntil: animal.quarantineUntil,
        message:
          'This animal must be released from quarantine by a veterinarian before it can be assigned to a cage.',
      },
      403,
    );
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: cage.rack.room.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  // Density check using compliance engine (with protocol exemption if approved)
  const protocolExemption =
    animal.protocol?.status === 'approved' && animal.protocol.densityExemption
      ? animal.protocol.densityExemption
      : null;

  const densityResult = calculateMaxDensity({
    species: animal.species,
    weightGrams: 25, // Default weight for density calculation
    currentCount: cage.animals.length,
    addingCount: 1,
    protocolApprovedDensity: protocolExemption,
  });

  if (!densityResult.allowed) {
    return c.json(
      {
        error: 'Density limit exceeded',
        maxCount: densityResult.maxCount,
        currentCount: cage.animals.length,
        reason: densityResult.reason,
      },
      400,
    );
  }

  // Assign animal to cage
  const updatedAnimal = await prisma.animal.update({
    where: { id: body.animalId },
    data: { cageId },
  });

  return c.json({ success: true, animal: updatedAnimal });
});

// POST /api/cages/:id/remove-animal — remove animal from cage
cages.post('/:id/remove-animal', async (c) => {
  const cageId = c.req.param('id');
  const user = getUser(c);
  const body = await c.req.json<{ animalId: string }>();

  if (!body.animalId) {
    return c.json({ error: 'animalId is required' }, 400);
  }

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

  const updatedAnimal = await prisma.animal.update({
    where: { id: body.animalId },
    data: { cageId: null },
  });

  return c.json({ success: true, animal: updatedAnimal });
});

// DELETE /api/cages/:id — delete cage
cages.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);

  const cage = await prisma.cage.findUnique({
    where: { id },
    include: {
      rack: { include: { room: { select: { labId: true } } } },
      animals: { select: { id: true } },
    },
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

  if (cage.animals.length > 0) {
    return c.json({ error: 'Cannot delete cage with animals. Remove animals first.' }, 400);
  }

  await prisma.cage.delete({ where: { id } });

  return c.json({ success: true });
});

export { cages };
