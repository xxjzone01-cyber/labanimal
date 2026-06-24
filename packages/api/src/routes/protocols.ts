import { Hono } from 'hono';
import { prisma } from '../lib/db.js';
import { authMiddleware, getUser } from '../middleware/auth.js';
import { validateProtocol, isValidStatusTransition } from '@labanimal/compliance';

const protocols = new Hono();

protocols.use('*', authMiddleware);

// GET /api/protocols — list protocols
protocols.get('/', async (c) => {
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

  const items = await prisma.protocol.findMany({
    where: { labId },
    include: { _count: { select: { animals: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return c.json(items.map((p) => ({
    ...p,
    animalCount: p._count.animals,
    _count: undefined,
  })));
});

// POST /api/protocols — create protocol
protocols.post('/', async (c) => {
  const body = await c.req.json<{
    labId: string;
    title: string;
    description?: string;
    piName: string;
    iacucNumber?: string;
    status?: string;
    painCategory?: string;
    startDate?: string;
    endDate?: string;
    animalLimit?: number;
    densityExemption?: number;
    threeRsReplacement?: string;
    threeRsReduction?: string;
    threeRsRefinement?: string;
    hasStatisticalJustification?: boolean;
    involvesSurgery?: boolean;
    survivalSurgery?: boolean;
    usesAnalgesics?: boolean;
    hasHumaneEndpoints?: boolean;
  }>();

  if (!body.labId || !body.title || !body.piName) {
    return c.json({ error: 'labId, title, and piName are required' }, 400);
  }

  const protocol = await prisma.protocol.create({
    data: {
      labId: body.labId,
      title: body.title,
      description: body.description,
      piName: body.piName,
      iacucNumber: body.iacucNumber,
      status: body.status || 'draft',
      painCategory: body.painCategory,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      animalLimit: body.animalLimit,
      densityExemption: body.densityExemption,
      threeRsReplacement: body.threeRsReplacement,
      threeRsReduction: body.threeRsReduction,
      threeRsRefinement: body.threeRsRefinement,
      hasStatisticalJustification: body.hasStatisticalJustification,
      involvesSurgery: body.involvesSurgery,
      survivalSurgery: body.survivalSurgery,
      usesAnalgesics: body.usesAnalgesics,
      hasHumaneEndpoints: body.hasHumaneEndpoints,
    },
  });

  return c.json(protocol, 201);
});

// GET /api/protocols/:id — get protocol detail
protocols.get('/:id', async (c) => {
  const id = c.req.param('id');

  const protocol = await prisma.protocol.findUnique({
    where: { id },
    include: { animals: { take: 50, orderBy: { internalId: 'asc' } } },
  });

  if (!protocol) {
    return c.json({ error: 'Protocol not found' }, 404);
  }

  return c.json(protocol);
});

// PUT /api/protocols/:id — update protocol
protocols.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<Record<string, unknown>>();

  const existing = await prisma.protocol.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: 'Protocol not found' }, 404);
  }

  // Status transition validation
  if (body.status && body.status !== existing.status) {
    const valid = isValidStatusTransition(
      existing.status as 'draft' | 'submitted' | 'approved' | 'rejected' | 'expired',
      body.status as 'draft' | 'submitted' | 'approved' | 'rejected' | 'expired'
    );
    if (!valid) {
      return c.json({
        error: 'Invalid status transition',
        from: existing.status,
        to: body.status,
        allowed: getValidTransitions(existing.status),
      }, 400);
    }

    // Set timestamp fields for status changes
    if (body.status === 'submitted') {
      (body as Record<string, unknown>).submittedAt = new Date();
    } else if (body.status === 'approved') {
      (body as Record<string, unknown>).approvedAt = new Date();
      (body as Record<string, unknown>).approvedBy = getUser(c).userId;
    } else if (body.status === 'rejected') {
      (body as Record<string, unknown>).rejectedAt = new Date();
      (body as Record<string, unknown>).rejectedBy = getUser(c).userId;
    }
  }

  const protocol = await prisma.protocol.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title as string }),
      ...(body.description !== undefined && { description: body.description as string }),
      ...(body.piName !== undefined && { piName: body.piName as string }),
      ...(body.iacucNumber !== undefined && { iacucNumber: body.iacucNumber as string }),
      ...(body.status !== undefined && { status: body.status as string }),
      ...(body.painCategory !== undefined && { painCategory: body.painCategory as string }),
      ...(body.startDate !== undefined && { startDate: body.startDate ? new Date(body.startDate as string) : null }),
      ...(body.endDate !== undefined && { endDate: body.endDate ? new Date(body.endDate as string) : null }),
      ...(body.animalLimit !== undefined && { animalLimit: body.animalLimit as number }),
      ...(body.densityExemption !== undefined && { densityExemption: body.densityExemption as number }),
      ...(body.threeRsReplacement !== undefined && { threeRsReplacement: body.threeRsReplacement as string }),
      ...(body.threeRsReduction !== undefined && { threeRsReduction: body.threeRsReduction as string }),
      ...(body.threeRsRefinement !== undefined && { threeRsRefinement: body.threeRsRefinement as string }),
      ...(body.hasStatisticalJustification !== undefined && { hasStatisticalJustification: body.hasStatisticalJustification as boolean }),
      ...(body.involvesSurgery !== undefined && { involvesSurgery: body.involvesSurgery as boolean }),
      ...(body.survivalSurgery !== undefined && { survivalSurgery: body.survivalSurgery as boolean }),
      ...(body.usesAnalgesics !== undefined && { usesAnalgesics: body.usesAnalgesics as boolean }),
      ...(body.hasHumaneEndpoints !== undefined && { hasHumaneEndpoints: body.hasHumaneEndpoints as boolean }),
      ...(body.submittedAt !== undefined && { submittedAt: body.submittedAt as Date }),
      ...(body.approvedAt !== undefined && { approvedAt: body.approvedAt as Date }),
      ...(body.approvedBy !== undefined && { approvedBy: body.approvedBy as string }),
      ...(body.rejectedAt !== undefined && { rejectedAt: body.rejectedAt as Date }),
      ...(body.rejectedBy !== undefined && { rejectedBy: body.rejectedBy as string }),
      ...(body.reviewComments !== undefined && { reviewComments: body.reviewComments as string }),
    },
  });

  return c.json(protocol);
});

// POST /api/protocols/:id/validate — run 3R compliance validation
protocols.post('/:id/validate', async (c) => {
  const id = c.req.param('id');

  const protocol = await prisma.protocol.findUnique({ where: { id } });
  if (!protocol) {
    return c.json({ error: 'Protocol not found' }, 404);
  }

  const result = validateProtocol({
    title: protocol.title,
    piName: protocol.piName,
    iacucNumber: protocol.iacucNumber || undefined,
    status: protocol.status as 'draft' | 'submitted' | 'approved' | 'rejected' | 'expired',
    startDate: protocol.startDate?.toISOString(),
    endDate: protocol.endDate?.toISOString(),
    species: [], // Would need to be derived from animals or explicit field
    animalCounts: protocol.animalLimit ? { total: protocol.animalLimit } : {},
    alternativesConsidered: !!protocol.threeRsReplacement,
    alternativesExplanation: protocol.threeRsReplacement || undefined,
    hasStatisticalJustification: protocol.hasStatisticalJustification || false,
    painCategory: (protocol.painCategory as 'B' | 'C' | 'D' | 'E') || 'B',
    usesAnalgesics: protocol.usesAnalgesics || false,
    hasHumaneEndpoints: protocol.hasHumaneEndpoints || false,
    personnelTrained: true, // Would check Training records
    involvesSurgery: protocol.involvesSurgery || false,
    survivalSurgery: protocol.survivalSurgery || false,
  });

  return c.json(result);
});

// DELETE /api/protocols/:id — delete protocol
protocols.delete('/:id', async (c) => {
  const id = c.req.param('id');

  const existing = await prisma.protocol.findUnique({
    where: { id },
    include: { _count: { select: { animals: true } } },
  });
  if (!existing) {
    return c.json({ error: 'Protocol not found' }, 404);
  }

  if (existing.status === 'approved' && existing._count.animals > 0) {
    return c.json({
      error: 'Cannot delete an approved protocol with active animals',
      animalCount: existing._count.animals,
    }, 400);
  }

  await prisma.protocol.delete({ where: { id } });

  return c.json({ success: true });
});

function getValidTransitions(status: string): string[] {
  const transitions: Record<string, string[]> = {
    draft: ['submitted'],
    submitted: ['approved', 'rejected'],
    approved: ['expired'],
    rejected: ['draft'],
    expired: ['draft'],
  };
  return transitions[status] || [];
}

export { protocols };
