import { Hono } from 'hono';
import { prisma } from '../lib/db.js';
import { authMiddleware, getUser } from '../middleware/auth.js';

const trainings = new Hono();

trainings.use('*', authMiddleware);

// GET /api/trainings — list training records
trainings.get('/', async (c) => {
  const user = getUser(c);
  const labId = c.req.query('labId');
  const userId = c.req.query('userId');
  const type = c.req.query('type');
  const status = c.req.query('status');

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
  if (userId) where.userId = userId;
  if (type) where.type = type;
  if (status) where.status = status;

  const [items, total] = await Promise.all([
    prisma.training.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.training.count({ where }),
  ]);

  // Auto-update expired statuses
  const now = new Date();
  const updatedItems = await Promise.all(
    items.map(async (item) => {
      if (item.expirationDate && item.expirationDate < now && item.status === 'active') {
        const updated = await prisma.training.update({
          where: { id: item.id },
          data: { status: 'expired' },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        });
        return updated;
      }
      if (item.expirationDate) {
        const daysUntilExpiry = Math.ceil((item.expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilExpiry <= 30 && daysUntilExpiry > 0 && item.status === 'active') {
          const updated = await prisma.training.update({
            where: { id: item.id },
            data: { status: 'pending_renewal' },
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          });
          return updated;
        }
      }
      return item;
    })
  );

  return c.json({ items: updatedItems, total, page, limit, pages: Math.ceil(total / limit) });
});

// POST /api/trainings — create training record
trainings.post('/', async (c) => {
  const user = getUser(c);
  const body = await c.req.json<{
    userId: string;
    labId: string;
    type: string;
    certificationNumber?: string;
    issuedBy?: string;
    issuedDate?: string;
    expirationDate?: string;
    status?: string;
    documentUrl?: string;
    notes?: string;
  }>();

  if (!body.userId || !body.labId || !body.type) {
    return c.json({ error: 'userId, labId, and type are required' }, 400);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: body.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const training = await prisma.training.create({
    data: {
      userId: body.userId,
      labId: body.labId,
      type: body.type,
      certificationNumber: body.certificationNumber,
      issuedBy: body.issuedBy,
      issuedDate: body.issuedDate ? new Date(body.issuedDate) : null,
      expirationDate: body.expirationDate ? new Date(body.expirationDate) : null,
      status: body.status || 'active',
      documentUrl: body.documentUrl,
      notes: body.notes,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return c.json(training, 201);
});

// GET /api/trainings/:id — get training detail
trainings.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);

  const training = await prisma.training.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  if (!training) {
    return c.json({ error: 'Training record not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: training.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  return c.json(training);
});

// PUT /api/trainings/:id — update training record
trainings.put('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);
  const body = await c.req.json<Record<string, unknown>>();

  const existing = await prisma.training.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: 'Training record not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: existing.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const training = await prisma.training.update({
    where: { id },
    data: {
      ...(body.type !== undefined && { type: body.type as string }),
      ...(body.certificationNumber !== undefined && { certificationNumber: body.certificationNumber as string }),
      ...(body.issuedBy !== undefined && { issuedBy: body.issuedBy as string }),
      ...(body.issuedDate !== undefined && { issuedDate: body.issuedDate ? new Date(body.issuedDate as string) : null }),
      ...(body.expirationDate !== undefined && { expirationDate: body.expirationDate ? new Date(body.expirationDate as string) : null }),
      ...(body.status !== undefined && { status: body.status as string }),
      ...(body.documentUrl !== undefined && { documentUrl: body.documentUrl as string }),
      ...(body.notes !== undefined && { notes: body.notes as string }),
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return c.json(training);
});

// DELETE /api/trainings/:id — delete training record
trainings.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);

  const training = await prisma.training.findUnique({ where: { id } });
  if (!training) {
    return c.json({ error: 'Training record not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: training.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  await prisma.training.delete({ where: { id } });

  return c.json({ success: true });
});

export { trainings };
