import { Hono } from 'hono';
import { prisma } from '../lib/db.js';
import { authMiddleware, getUser } from '../middleware/auth.js';
import { signToken, verifyToken } from '../lib/auth.js';
import { sendInviteEmail, sendWelcomeEmail } from '../lib/email/send.js';

const labs = new Hono();

// 所有 lab 路由需要认证
labs.use('*', authMiddleware);

// POST /api/labs — 创建实验室（开源版每用户限 1 个）
labs.post('/', async (c) => {
  const user = getUser(c);
  const body = await c.req.json<{ name: string; institution?: string; address?: string }>();

  if (!body.name) {
    return c.json({ error: 'name is required' }, 400);
  }

  // 创建实验室并自动关联创建者为 pi
  const lab = await prisma.lab.create({
    data: {
      name: body.name,
      institution: body.institution,
      address: body.address,
      users: {
        create: {
          userId: user.userId,
          role: 'pi',
        },
      },
    },
    include: {
      users: { select: { userId: true, role: true } },
    },
  });

  return c.json(lab, 201);
});

// GET /api/labs/:id — 获取实验室详情
labs.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);

  const lab = await prisma.lab.findUnique({
    where: { id },
    include: {
      users: { select: { userId: true, role: true } },
    },
  });

  if (!lab) {
    return c.json({ error: 'Lab not found' }, 404);
  }

  // 检查用户是否属于该实验室
  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: id } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  return c.json(lab);
});

// GET /api/labs/:id/members — 列出实验室成员
labs.get('/:id/members', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);

  // 检查用户是否属于该实验室
  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: id } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const members = await prisma.userLab.findMany({
    where: { labId: id },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
  });

  return c.json(members);
});

// POST /api/labs/:id/members — 添加成员（开源版每实验室限 10 人）
labs.post('/:id/members', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);
  const body = await c.req.json<{ userId: string; role: string }>();

  if (!body.userId || !body.role) {
    return c.json({ error: 'userId and role are required' }, 400);
  }

  // 检查操作者是否为该实验室的 pi 或 admin
  const operatorMembership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: id } },
  });
  if (!operatorMembership || !['pi', 'admin'].includes(operatorMembership.role)) {
    return c.json({ error: 'Only PI or admin can add members' }, 403);
  }

  // 检查目标用户是否存在
  const targetUser = await prisma.user.findUnique({
    where: { id: body.userId },
  });
  if (!targetUser) {
    return c.json({ error: 'User not found' }, 404);
  }

  // 检查是否已经是成员
  const existing = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: body.userId, labId: id } },
  });
  if (existing) {
    return c.json({ error: 'User is already a member of this lab' }, 409);
  }

  const member = await prisma.userLab.create({
    data: {
      userId: body.userId,
      labId: id,
      role: body.role,
    },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
  });

  return c.json(member, 201);
});

// DELETE /api/labs/:id/members/:userId — 移除成员
labs.delete('/:id/members/:userId', async (c) => {
  const id = c.req.param('id');
  const targetUserId = c.req.param('userId');
  const user = getUser(c);

  // 检查操作者是否为 pi 或 admin
  const operatorMembership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: id } },
  });
  if (!operatorMembership || !['pi', 'admin'].includes(operatorMembership.role)) {
    return c.json({ error: 'Only PI or admin can remove members' }, 403);
  }

  // 不能移除自己
  if (targetUserId === user.userId) {
    return c.json({ error: 'Cannot remove yourself from the lab' }, 400);
  }

  // 检查目标是否为成员
  const targetMembership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: targetUserId, labId: id } },
  });
  if (!targetMembership) {
    return c.json({ error: 'User is not a member of this lab' }, 404);
  }

  await prisma.userLab.delete({
    where: { userId_labId: { userId: targetUserId, labId: id } },
  });

  return c.json({ success: true });
});

// POST /api/labs/:id/invite — 邀请成员（发送邀请邮件）
labs.post('/:id/invite', async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);
  const body = await c.req.json<{ email: string; role: string }>();

  if (!body.email || !body.role) {
    return c.json({ error: 'email and role are required' }, 400);
  }

  // 检查操作者是否为 pi 或 admin
  const operatorMembership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: id } },
  });
  if (!operatorMembership || !['pi', 'admin'].includes(operatorMembership.role)) {
    return c.json({ error: 'Only PI or admin can invite members' }, 403);
  }

  const lab = await prisma.lab.findUnique({ where: { id }, select: { name: true } });
  if (!lab) return c.json({ error: 'Lab not found' }, 404);

  // 检查目标用户是否已经是成员
  const existingUser = await prisma.user.findUnique({
    where: { email: body.email },
    select: { id: true },
  });
  if (existingUser) {
    const existingMember = await prisma.userLab.findUnique({
      where: { userId_labId: { userId: existingUser.id, labId: id } },
    });
    if (existingMember) {
      return c.json({ error: 'User is already a member of this lab' }, 409);
    }
  }

  // 生成邀请 token（7天有效）
  const inviteToken = signToken(
    { userId: 'invite', email: body.email, purpose: `lab-invite:${id}:${body.role}` },
    '7d',
  );

  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const inviteLink = `${appUrl}/accept-invite?token=${inviteToken}`;

  const operatorUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { name: true },
  });

  sendInviteEmail(body.email, {
    inviterName: operatorUser?.name || 'A team member',
    labName: lab.name,
    role: body.role,
    inviteLink,
  });

  return c.json({ message: 'Invitation sent', email: body.email });
});

// POST /api/labs/accept-invite — 接受邀请
labs.post('/accept-invite', async (c) => {
  const body = await c.req.json<{ token: string }>();

  if (!body.token) return c.json({ error: 'Token is required' }, 400);

  let payload;
  try {
    payload = verifyToken(body.token);
  } catch {
    return c.json({ error: 'Invalid or expired invitation token' }, 400);
  }

  // 解析 purpose: lab-invite:labId:role
  if (!payload.purpose?.startsWith('lab-invite:')) {
    return c.json({ error: 'Invalid invitation token' }, 400);
  }

  const parts = payload.purpose.split(':');
  const labId = parts[1];
  const role = parts[2];
  if (!labId || !role) return c.json({ error: 'Malformed invitation token' }, 400);

  // 查找或创建用户
  let targetUser = await prisma.user.findUnique({
    where: { email: payload.email },
    select: { id: true, email: true, name: true },
  });

  if (!targetUser) {
    // 新用户：创建账户（无密码，需后续设置）
    targetUser = await prisma.user.create({
      data: { email: payload.email, name: payload.email.split('@')[0] },
      select: { id: true, email: true, name: true },
    });
    sendWelcomeEmail(targetUser.email, targetUser.name);
  }

  // 检查是否已经是成员
  const existing = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: targetUser.id, labId } },
  });
  if (existing) return c.json({ error: 'Already a member' }, 409);

  // 创建成员关系
  const member = await prisma.userLab.create({
    data: { userId: targetUser.id, labId, role },
    include: { lab: { select: { name: true } } },
  });

  return c.json({ user: targetUser, lab: (member as any).lab, role }, 201);
});

export { labs };
