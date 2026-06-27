import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { hashPassword, verifyPassword, signToken, verifyToken } from '../lib/auth.js';
import { sendVerificationCode, verifyCode } from '../lib/verification.js';
import { sendWelcomeEmail, sendPasswordReset } from '../lib/email/send.js';
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

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-z]/, 'Password must contain lowercase letter')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/[0-9]/, 'Password must contain number'),
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

  // fire-and-forget 欢迎邮件
  sendWelcomeEmail(user.email, user.name);

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

// 忘记密码 — 发送重置链接
auth.post('/forgot-password', async (c) => {
  const body = parseBody(forgotPasswordSchema, await c.req.json());

  // 不论用户是否存在都返回相同消息（防邮箱枚举）
  const user = await prisma.user.findUnique({
    where: { email: body.email },
    select: { id: true, email: true, name: true },
  });

  if (user) {
    const resetToken = signToken(
      { userId: user.id, email: user.email, purpose: 'password-reset' },
      '1h',
    );
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const resetLink = `${appUrl}/reset-password?token=${resetToken}`;
    sendPasswordReset(user.email, user.name, resetLink);
  }

  return c.json({ message: 'If an account with that email exists, a reset link has been sent.' });
});

// 重置密码 — 验证 token 并更新密码
auth.post('/reset-password', async (c) => {
  const body = parseBody(resetPasswordSchema, await c.req.json());

  let payload;
  try {
    payload = verifyToken(body.token);
  } catch {
    return c.json({ error: 'Invalid or expired reset token' }, 400);
  }

  if (payload.purpose !== 'password-reset') {
    return c.json({ error: 'Invalid reset token' }, 400);
  }

  const passwordHash = await hashPassword(body.newPassword);

  await prisma.user.update({
    where: { id: payload.userId },
    data: { passwordHash },
  });

  return c.json({ message: 'Password has been reset successfully' });
});

auth.post('/logout', (c) => {
  // 无状态 JWT，客户端自行丢弃 token 即可
  return c.json({ message: 'Logged out successfully' });
});

export { auth };
