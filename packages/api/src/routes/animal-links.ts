import { Hono } from 'hono';
import { prisma } from '../lib/db.js';
import { authMiddleware, getUser } from '../middleware/auth.js';

const animalLinks = new Hono();

animalLinks.use('*', authMiddleware);

// GET /api/animal-links — list animal links
animalLinks.get('/', async (c) => {
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
  if (animalId) {
    where.OR = [
      { animalId },
      { linkedToId: animalId },
    ];
  }

  const items = await prisma.animalLink.findMany({
    where,
    include: {
      animal: { select: { id: true, internalId: true, species: true, status: true } },
      linkedTo: { select: { id: true, internalId: true, species: true, status: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return c.json(items);
});

// POST /api/animal-links — create animal link
animalLinks.post('/', async (c) => {
  const user = getUser(c);
  const body = await c.req.json<{
    animalId: string;
    linkedToId: string;
    reason: string;
  }>();

  if (!body.animalId || !body.linkedToId || !body.reason) {
    return c.json({ error: 'animalId, linkedToId, and reason are required' }, 400);
  }

  if (body.animalId === body.linkedToId) {
    return c.json({ error: 'Cannot link an animal to itself' }, 400);
  }

  // Verify both animals exist and user has access
  const [animal, linkedTo] = await Promise.all([
    prisma.animal.findUnique({ where: { id: body.animalId } }),
    prisma.animal.findUnique({ where: { id: body.linkedToId } }),
  ]);

  if (!animal) {
    return c.json({ error: 'Animal not found' }, 404);
  }
  if (!linkedTo) {
    return c.json({ error: 'Linked animal not found' }, 404);
  }

  // Both animals must be in the same lab
  if (animal.labId !== linkedTo.labId) {
    return c.json({ error: 'Both animals must belong to the same lab' }, 400);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: animal.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied to this lab' }, 403);
  }

  // Create link and retire old animal in transaction
  const result = await prisma.$transaction(async (tx) => {
    const link = await tx.animalLink.create({
      data: {
        animalId: body.animalId,
        labId: animal.labId,
        linkedToId: body.linkedToId,
        reason: body.reason,
      },
      include: {
        animal: { select: { id: true, internalId: true, species: true, status: true } },
        linkedTo: { select: { id: true, internalId: true, species: true, status: true } },
      },
    });

    // Retire the old animal
    await tx.animal.update({
      where: { id: body.animalId },
      data: { status: 'retired' },
    });

    return link;
  });

  return c.json(result, 201);
});

// GET /api/animal-links/:id — get link detail
animalLinks.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);

  const link = await prisma.animalLink.findUnique({
    where: { id },
    include: {
      animal: { select: { id: true, internalId: true, species: true, status: true, labId: true } },
      linkedTo: { select: { id: true, internalId: true, species: true, status: true } },
    },
  });

  if (!link) {
    return c.json({ error: 'Animal link not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: link.animal.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  return c.json(link);
});

// DELETE /api/animal-links/:id — delete link
animalLinks.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);

  const link = await prisma.animalLink.findUnique({
    where: { id },
    include: { animal: { select: { labId: true } } },
  });
  if (!link) {
    return c.json({ error: 'Animal link not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: link.animal.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  await prisma.animalLink.delete({ where: { id } });

  return c.json({ success: true });
});

export { animalLinks };
