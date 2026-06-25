import { Hono } from 'hono';
import { prisma } from '../lib/db.js';
import { hashPassword, verifyPassword, signToken } from '../lib/auth.js';

const auth = new Hono();

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

auth.post('/logout', (c) => {
  // 无状态 JWT，客户端自行丢弃 token 即可
  return c.json({ message: 'Logged out successfully' });
});

export { auth };
