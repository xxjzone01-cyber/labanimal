import { Hono } from 'hono';
import { prisma } from '../lib/db.js';
import { authMiddleware, getUser } from '../middleware/auth.js';

const labs = new Hono();

// 开源版限制
const OPEN_SOURCE_LAB_LIMIT_PER_USER = 1;
const OPEN_SOURCE_MEMBER_LIMIT_PER_LAB = 10;

// 所有 lab 路由需要认证
labs.use('*', authMiddleware);

// POST /api/labs — 创建实验室（开源版每用户限 1 个）
labs.post('/', async (c) => {
  const user = getUser(c);
  const body = await c.req.json<{ name: string; institution?: string; address?: string }>();

  if (!body.name) {
    return c.json({ error: 'name is required' }, 400);
  }

  // 检查该用户已拥有的实验室数量（作为 pi 或 admin 角色）
  const existingLabs = await prisma.userLab.count({
    where: {
      userId: user.userId,
      role: { in: ['pi', 'admin'] },
    },
  });

  if (existingLabs >= OPEN_SOURCE_LAB_LIMIT_PER_USER) {
    return c.json({
      error: 'Open-source lab limit reached',
      limit: OPEN_SOURCE_LAB_LIMIT_PER_USER,
      current: existingLabs,
      message: `Open-source version supports up to ${OPEN_SOURCE_LAB_LIMIT_PER_USER} lab per user. Upgrade to LabAnimal Pro for unlimited labs.`,
    }, 403);
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

  // 开源版：每实验室成员数量限制
  const memberCount = await prisma.userLab.count({
    where: { labId: id },
  });

  if (memberCount >= OPEN_SOURCE_MEMBER_LIMIT_PER_LAB) {
    return c.json({
      error: 'Open-source member limit reached',
      limit: OPEN_SOURCE_MEMBER_LIMIT_PER_LAB,
      current: memberCount,
      message: `This lab has reached the ${OPEN_SOURCE_MEMBER_LIMIT_PER_LAB}-member limit for the open-source edition. Upgrade to LabAnimal Pro for unlimited members.`,
    }, 403);
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

export { labs };
