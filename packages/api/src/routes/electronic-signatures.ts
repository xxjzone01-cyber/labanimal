import { Hono } from 'hono';
import { prisma } from '../lib/db.js';
import { authMiddleware, getUser } from '../middleware/auth.js';
import { sha256 } from '@labanimal/compliance';

const electronicSignatures = new Hono();

electronicSignatures.use('*', authMiddleware);

// GET /api/electronic-signatures — list signatures
electronicSignatures.get('/', async (c) => {
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
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);

  const where: Record<string, unknown> = {};
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;
  if (userId) where.userId = userId;

  // Filter by lab through related entities
  // For protocol signatures
  if (entityType === 'protocol') {
    where.protocol = { labId };
  }

  const [items, total] = await Promise.all([
    prisma.electronicSignature.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, name: true, email: true } },
        protocol: { select: { id: true, title: true } },
      },
      orderBy: { signedAt: 'desc' },
    }),
    prisma.electronicSignature.count({ where }),
  ]);

  return c.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
});

// POST /api/electronic-signatures — create signature
electronicSignatures.post('/', async (c) => {
  const user = getUser(c);
  const body = await c.req.json<{
    protocolId?: string;
    entityType: string;
    entityId: string;
    meaning: string;
    printedName?: string;
    title?: string;
    reasonForSigning?: string;
    notes?: string;
  }>();

  if (!body.entityType || !body.entityId || !body.meaning) {
    return c.json({ error: 'entityType, entityId, and meaning are required' }, 400);
  }

  // 21 CFR Part 11: printedName defaults to user's name if not provided
  const signerUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { name: true },
  });
  const printedName = body.printedName || signerUser?.name || 'Unknown';

  // Validate meaning enum
  const validMeanings = ['approved', 'reviewed', 'witnessed', 'authored'];
  if (!validMeanings.includes(body.meaning)) {
    return c.json({ error: `meaning must be one of: ${validMeanings.join(', ')}` }, 400);
  }

  // Determine labId from protocol or user context
  let labId: string | undefined;
  if (body.protocolId) {
    const protocol = await prisma.protocol.findUnique({
      where: { id: body.protocolId },
      select: { labId: true },
    });
    if (!protocol) {
      return c.json({ error: 'Protocol not found' }, 404);
    }
    labId = protocol.labId;
  }
  if (!labId) {
    labId = getUser(c).labId;
  }
  if (!labId) {
    return c.json({ error: 'labId could not be determined. Provide a protocolId or set X-Lab-Id header.' }, 400);
  }

  // Calculate signature hash (21 CFR Part 11 compliant)
  const signedAt = new Date();
  const ipAddress = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';

  const signatureHash = await sha256(
    `${user.userId}|${body.entityType}|${body.entityId}|${signedAt.toISOString()}`
  );

  const signature = await prisma.electronicSignature.create({
    data: {
      userId: user.userId,
      labId,
      protocolId: body.protocolId,
      entityType: body.entityType,
      entityId: body.entityId,
      meaning: body.meaning,
      printedName,
      title: body.title,
      reasonForSigning: body.reasonForSigning,
      signatureHash,
      signedAt,
      ipAddress,
      notes: body.notes,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      protocol: { select: { id: true, title: true } },
    },
  });

  return c.json(signature, 201);
});

// GET /api/electronic-signatures/:id — get signature detail
electronicSignatures.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);

  const signature = await prisma.electronicSignature.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      protocol: { select: { id: true, title: true, labId: true } },
    },
  });

  if (!signature) {
    return c.json({ error: 'Signature not found' }, 404);
  }

  // Check access through protocol if available
  if (signature.protocol?.labId) {
    const membership = await prisma.userLab.findUnique({
      where: { userId_labId: { userId: user.userId, labId: signature.protocol.labId } },
    });
    if (!membership) {
      return c.json({ error: 'Access denied' }, 403);
    }
  }

  return c.json(signature);
});

// GET /api/electronic-signatures/:id/verify — verify signature integrity
electronicSignatures.get('/:id/verify', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);

  const signature = await prisma.electronicSignature.findUnique({
    where: { id },
    include: {
      protocol: { select: { labId: true } },
    },
  });

  if (!signature) {
    return c.json({ error: 'Signature not found' }, 404);
  }

  // Check access
  if (signature.protocol?.labId) {
    const membership = await prisma.userLab.findUnique({
      where: { userId_labId: { userId: user.userId, labId: signature.protocol.labId } },
    });
    if (!membership) {
      return c.json({ error: 'Access denied' }, 403);
    }
  }

  // Recalculate hash
  const computedHash = await sha256(
    `${signature.userId}|${signature.entityType}|${signature.entityId}|${signature.signedAt.toISOString()}`
  );

  const valid = computedHash === signature.signatureHash;

  return c.json({
    valid,
    signatureId: signature.id,
    signedAt: signature.signedAt,
    computedHash,
    storedHash: signature.signatureHash,
  });
});

export { electronicSignatures };
