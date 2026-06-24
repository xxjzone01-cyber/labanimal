import { Hono } from 'hono';
import { prisma } from '../lib/db.js';
import { authMiddleware, getUser } from '../middleware/auth.js';

const workSessions = new Hono();

workSessions.use('*', authMiddleware);

// GET /api/work-sessions — list work sessions
workSessions.get('/', async (c) => {
  const user = getUser(c);
  const labId = c.req.query('labId');
  const userId = c.req.query('userId');
  const activeOnly = c.req.query('activeOnly');

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
  if (activeOnly === 'true') {
    where.endedAt = null;
  }

  const [items, total] = await Promise.all([
    prisma.workSession.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { startedAt: 'desc' },
    }),
    prisma.workSession.count({ where }),
  ]);

  return c.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
});

// Helper: check if two dates are on the same day (local time)
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

// GET /api/work-sessions/active — get current user's active session
workSessions.get('/active', async (c) => {
  const user = getUser(c);
  const labId = c.req.query('labId');

  if (!labId) {
    return c.json({ error: 'labId query parameter is required' }, 400);
  }

  const session = await prisma.workSession.findFirst({
    where: {
      userId: user.userId,
      labId,
      endedAt: null,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  if (!session) {
    return c.json({ error: 'No active session found' }, 404);
  }

  const now = new Date();

  // Cross-day block: auto-close if session started on a different day
  if (!isSameDay(session.startedAt, now)) {
    const ended = await prisma.workSession.update({
      where: { id: session.id },
      data: { endedAt: new Date(session.startedAt.getFullYear(), session.startedAt.getMonth(), session.startedAt.getDate(), 23, 59, 59) },
    });
    return c.json({ ...ended, crossDayClosed: true, message: 'Session auto-closed: work sessions cannot span multiple days.' });
  }

  // Check for timeout
  if (now > session.timeoutAt) {
    const ended = await prisma.workSession.update({
      where: { id: session.id },
      data: { endedAt: session.timeoutAt },
    });
    return c.json({ ...ended, timedOut: true });
  }

  return c.json(session);
});

// POST /api/work-sessions — start work session
workSessions.post('/', async (c) => {
  const user = getUser(c);
  const body = await c.req.json<{ labId: string }>();

  if (!body.labId) {
    return c.json({ error: 'labId is required' }, 400);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: body.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  // Check for existing active session
  const existingSession = await prisma.workSession.findFirst({
    where: {
      userId: user.userId,
      labId: body.labId,
      endedAt: null,
    },
  });

  if (existingSession) {
    const now = new Date();

    // Cross-day: auto-close yesterday's session and allow new one
    if (!isSameDay(existingSession.startedAt, now)) {
      await prisma.workSession.update({
        where: { id: existingSession.id },
        data: { endedAt: new Date(existingSession.startedAt.getFullYear(), existingSession.startedAt.getMonth(), existingSession.startedAt.getDate(), 23, 59, 59) },
      });
      // Fall through to create new session
    } else {
      return c.json({
        error: 'Active session already exists',
        sessionId: existingSession.id,
      }, 409);
    }
  }

  // Create session with 8-hour timeout
  const now = new Date();
  const timeoutAt = new Date(now.getTime() + 8 * 60 * 60 * 1000);

  const session = await prisma.workSession.create({
    data: {
      userId: user.userId,
      labId: body.labId,
      timeoutAt,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return c.json(session, 201);
});

// PUT /api/work-sessions/:id/end — end work session
workSessions.put('/:id/end', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);

  const session = await prisma.workSession.findUnique({ where: { id } });
  if (!session) {
    return c.json({ error: 'Work session not found' }, 404);
  }

  if (session.userId !== user.userId) {
    return c.json({ error: 'Access denied' }, 403);
  }

  if (session.endedAt) {
    return c.json({ error: 'Session already ended' }, 400);
  }

  const ended = await prisma.workSession.update({
    where: { id },
    data: { endedAt: new Date() },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return c.json(ended);
});

// GET /api/work-sessions/:id — get session detail
workSessions.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);

  const session = await prisma.workSession.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  if (!session) {
    return c.json({ error: 'Work session not found' }, 404);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: session.labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  return c.json(session);
});

export { workSessions };
