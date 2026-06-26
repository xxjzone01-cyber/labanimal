import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { hashPassword, verifyPassword, signToken } from '../lib/auth.js';
import { sendVerificationCode, verifyCode } from '../lib/verification.js';
import { loginRateLimit, registerRateLimit } from '../middleware/rate-limit.js';
import { parseBody } from '../middleware/validate.js';

const sendCodeSchema = z.object({
  email: z.string().email('Invalid email format'),
});

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-z]/, 'Password must contain lowercase letter')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/[0-9]/, 'Password must contain number'),
  name: z.string().min(1, 'Name is required'),
  verificationCode: z.string().length(6, 'Verification code must be 6 digits'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const auth = new Hono();

// 发送验证码
auth.post('/send-code', async (c) => {
  const body = parseBody(sendCodeSchema, await c.req.json());

  // 检查邮箱是否已注册
  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) {
    return c.json({ error: 'Email already registered' }, 409);
  }

  try {
    await sendVerificationCode(body.email);
    return c.json({ message: 'Verification code sent' });
  } catch (err: any) {
    console.error('Failed to send verification code:', err.message);
    return c.json({ error: 'Failed to send verification email' }, 500);
  }
});

// 注册（需要验证码）
auth.post('/register', registerRateLimit, async (c) => {
  const body = parseBody(registerSchema, await c.req.json());

  // 验证验证码
  if (!verifyCode(body.email, body.verificationCode)) {
    return c.json({ error: 'Invalid or expired verification code' }, 400);
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

auth.post('/login', loginRateLimit, async (c) => {
  const body = parseBody(loginSchema, await c.req.json());

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
