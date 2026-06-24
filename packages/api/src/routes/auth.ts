import { Hono } from 'hono';
import { prisma } from '../lib/db.js';
import { hashPassword, verifyPassword, signToken } from '../lib/auth.js';

const auth = new Hono();

const OPEN_SOURCE_USER_LIMIT = 10;

auth.post('/register', async (c) => {
  const body = await c.req.json<{ email: string; password: string; name: string }>();

  if (!body.email || !body.password || !body.name) {
    return c.json({ error: 'email, password, and name are required' }, 400);
  }

  // 先检查重复邮箱（优先于用户数量限制）
  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) {
    return c.json({ error: 'Email already registered' }, 409);
  }

  // 开源版用户数量限制
  const userCount = await prisma.user.count();
  if (userCount >= OPEN_SOURCE_USER_LIMIT) {
    return c.json({
      error: 'Open-source user limit reached',
      limit: OPEN_SOURCE_USER_LIMIT,
      current: userCount,
      message: `Open-source version supports up to ${OPEN_SOURCE_USER_LIMIT} users. Upgrade to LabAnimal Pro for unlimited users.`,
    }, 403);
  }

  const passwordHash = await hashPassword(body.password);

  const user = await prisma.user.create({
    data: {
      email: body.email,
      name: body.name,
      passwordHash,
    },
    select: { id: true, email: true, name: true },
  });

  const token = signToken({ userId: user.id, email: user.email });

  return c.json({ user, token, labs: [] }, 201);
});

auth.post('/login', async (c) => {
  const body = await c.req.json<{ email: string; password: string }>();

  if (!body.email || !body.password) {
    return c.json({ error: 'email and password are required' }, 400);
  }

  const user = await prisma.user.findUnique({
    where: { email: body.email },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      labs: { select: { labId: true, role: true } },
    },
  });

  if (!user || !user.passwordHash) {
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  const valid = await verifyPassword(body.password, user.passwordHash);
  if (!valid) {
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  const token = signToken({ userId: user.id, email: user.email });

  return c.json({
    user: { id: user.id, email: user.email, name: user.name },
    token,
    labs: user.labs,
  });
});

export { auth };
