import { Hono } from 'hono';
import { prisma } from '../lib/db.js';
import { authMiddleware, getUser } from '../middleware/auth.js';
import { hashAuditEntry, verifyAuditEntry, GENESIS_HASH } from '@labanimal/compliance';

const auditLog = new Hono();

auditLog.use('*', authMiddleware);

// GET /api/audit-log — list audit log entries
auditLog.get('/', async (c) => {
  const user = getUser(c);
  const labId = c.req.query('labId');
  const entityType = c.req.query('entityType');
  const entityId = c.req.query('entityId');
  const userId = c.req.query('userId');

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
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);

  const where: Record<string, unknown> = { labId };
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;
  if (userId) where.userId = userId;

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return c.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
});

// GET /api/audit-log/verify — verify hash chain integrity
auditLog.get('/verify', async (c) => {
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

  // Get all entries in chronological order
  const entries = await prisma.auditLog.findMany({
    where: { labId },
    orderBy: { createdAt: 'asc' },
  });

  if (entries.length === 0) {
    return c.json({ valid: true, message: 'No audit entries to verify', totalEntries: 0 });
  }

  let previousHash = GENESIS_HASH;
  let brokenAt: string | null = null;

  for (const entry of entries) {
    const isValid = await verifyAuditEntry(
      {
        timestamp: entry.createdAt.toISOString(),
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        diffJson: JSON.stringify(entry.diff),
        previousHash,
      },
      entry.hash
    );

    if (!isValid) {
      brokenAt = entry.id;
      break;
    }

    previousHash = entry.hash;
  }

  return c.json({
    valid: brokenAt === null,
    brokenAt,
    totalEntries: entries.length,
    message: brokenAt === null
      ? 'Hash chain is intact'
      : `Hash chain broken at entry ${brokenAt}`,
  });
});

// GET /api/audit-log/:id — get audit log entry detail
auditLog.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);

  const entry = await prisma.auditLog.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  if (!entry) {
    return c.json({ error: 'Audit log entry not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: entry.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  return c.json(entry);
});

// POST /api/audit-log — create audit log entry (internal use)
auditLog.post('/', async (c) => {
  const user = getUser(c);
  const body = await c.req.json<{
    labId: string;
    entityType: string;
    entityId: string;
    action: string;
    diff: unknown;
  }>();

  if (!body.labId || !body.entityType || !body.entityId || !body.action) {
    return c.json({ error: 'labId, entityType, entityId, and action are required' }, 400);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: body.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  // Get previous hash
  const lastEntry = await prisma.auditLog.findFirst({
    where: { labId: body.labId },
    orderBy: { createdAt: 'desc' },
    select: { hash: true },
  });

  const previousHash = lastEntry?.hash || GENESIS_HASH;
  const timestamp = new Date().toISOString();
  const diffJson = JSON.stringify(body.diff);

  // Calculate hash
  const hash = await hashAuditEntry({
    timestamp,
    entityType: body.entityType,
    entityId: body.entityId,
    action: body.action,
    diffJson,
    previousHash,
  });

  const entry = await prisma.auditLog.create({
    data: {
      labId: body.labId,
      userId: user.userId,
      action: body.action,
      entityType: body.entityType,
      entityId: body.entityId,
      diff: body.diff as any,
      hash,
      previousHash,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return c.json(entry, 201);
});

export { auditLog };
