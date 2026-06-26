import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { authMiddleware, getUser } from '../middleware/auth.js';
import { validateMethod } from '@labanimal/compliance';
import { parseBody } from '../middleware/validate.js';

const createDeathReportSchema = z.object({
  animalId: z.string().min(1, 'animalId is required'),
  labId: z.string().min(1, 'labId is required'),
  dateOfDeath: z.string().min(1, 'dateOfDeath is required'),
  cause: z.string().min(1, 'cause is required'),
  euthanasiaMethodId: z.string().optional(),
  performedBy: z.string().optional(),
  necropsyPerformed: z.boolean().optional(),
  necropsyFindings: z.string().optional(),
  notes: z.string().optional(),
});

const deathReports = new Hono();

deathReports.use('*', authMiddleware);

// GET /api/death-reports — list death reports
deathReports.get('/', async (c) => {
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

  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);

  const where: Record<string, unknown> = { labId };
  if (animalId) where.animalId = animalId;

  const [items, total] = await Promise.all([
    prisma.deathReport.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        animal: { select: { id: true, internalId: true, species: true } },
      },
      orderBy: { dateOfDeath: 'desc' },
    }),
    prisma.deathReport.count({ where }),
  ]);

  return c.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
});

// POST /api/death-reports — create death report
deathReports.post('/', async (c) => {
  const user = getUser(c);
  const body = parseBody(createDeathReportSchema, await c.req.json());

  // Verify animal exists and user has access
  const animal = await prisma.animal.findUnique({
    where: { id: body.animalId },
  });
  if (!animal) {
    return c.json({ error: 'Animal not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: body.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied to this lab' }, 403);
  }

  // AVMA validation for euthanasia
  if (body.cause === 'euthanasia') {
    if (!body.euthanasiaMethodId) {
      return c.json({ error: 'euthanasiaMethodId is required when cause is euthanasia' }, 400);
    }

    const validation = validateMethod({
      species: animal.species,
      methodId: body.euthanasiaMethodId,
    });

    if (!validation.allowed) {
      return c.json(
        {
          error: 'AVMA violation',
          violations: validation.violations,
          suggestedMethods: validation.suggestedMethods,
        },
        400,
      );
    }
  }

  // Create death report and update animal status in transaction
  const result = await prisma.$transaction(async (tx) => {
    const report = await tx.deathReport.create({
      data: {
        animalId: body.animalId,
        labId: body.labId,
        dateOfDeath: new Date(body.dateOfDeath),
        cause: body.cause,
        euthanasiaMethodId: body.euthanasiaMethodId,
        performedBy: body.performedBy,
        necropsyPerformed: body.necropsyPerformed || false,
        necropsyFindings: body.necropsyFindings,
        notes: body.notes,
      },
      include: {
        animal: { select: { id: true, internalId: true, species: true } },
      },
    });

    // Update animal status to deceased
    await tx.animal.update({
      where: { id: body.animalId },
      data: { status: 'deceased' },
    });

    return report;
  });

  return c.json(result, 201);
});

// GET /api/death-reports/:id — get death report detail
deathReports.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);

  const report = await prisma.deathReport.findUnique({
    where: { id },
    include: {
      animal: { select: { id: true, internalId: true, species: true, labId: true } },
    },
  });

  if (!report) {
    return c.json({ error: 'Death report not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: report.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  return c.json(report);
});

// PUT /api/death-reports/:id — update death report
deathReports.put('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);
  const body = await c.req.json<Record<string, unknown>>();

  const existing = await prisma.deathReport.findUnique({
    where: { id },
    include: { animal: { select: { species: true } } },
  });
  if (!existing) {
    return c.json({ error: 'Death report not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: existing.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  // AVMA validation if updating euthanasia method
  if (body.euthanasiaMethodId || (existing.cause === 'euthanasia' && body.cause !== undefined)) {
    const methodId = (body.euthanasiaMethodId as string) || existing.euthanasiaMethodId;
    if (methodId) {
      const validation = validateMethod({
        species: existing.animal.species,
        methodId,
      });

      if (!validation.allowed) {
        return c.json(
          {
            error: 'AVMA violation',
            violations: validation.violations,
            suggestedMethods: validation.suggestedMethods,
          },
          400,
        );
      }
    }
  }

  const report = await prisma.deathReport.update({
    where: { id },
    data: {
      ...(body.dateOfDeath !== undefined && { dateOfDeath: new Date(body.dateOfDeath as string) }),
      ...(body.cause !== undefined && { cause: body.cause as string }),
      ...(body.euthanasiaMethodId !== undefined && {
        euthanasiaMethodId: body.euthanasiaMethodId as string,
      }),
      ...(body.performedBy !== undefined && { performedBy: body.performedBy as string }),
      ...(body.necropsyPerformed !== undefined && {
        necropsyPerformed: body.necropsyPerformed as boolean,
      }),
      ...(body.necropsyFindings !== undefined && {
        necropsyFindings: body.necropsyFindings as string,
      }),
      ...(body.notes !== undefined && { notes: body.notes as string }),
    },
    include: {
      animal: { select: { id: true, internalId: true, species: true } },
    },
  });

  return c.json(report);
});

// DELETE /api/death-reports/:id — delete death report
deathReports.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);

  const report = await prisma.deathReport.findUnique({
    where: { id },
  });
  if (!report) {
    return c.json({ error: 'Death report not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: report.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  await prisma.deathReport.delete({ where: { id } });

  return c.json({ success: true });
});

export { deathReports };
