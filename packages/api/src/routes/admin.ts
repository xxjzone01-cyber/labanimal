import { Hono } from 'hono';
import { prisma } from '../lib/db.js';
import { authMiddleware, getUser } from '../middleware/auth.js';

export const admin = new Hono();

// 所有 admin 路由需要认证
admin.use('*', authMiddleware);

// admin 权限检查中间件
admin.use('*', async (c, next) => {
  const user = getUser(c);
  const membership = await prisma.userLab.findFirst({
    where: { userId: user.userId, role: 'admin' },
  });
  if (!membership) {
    return c.json({ error: 'Admin access required' }, 403);
  }
  await next();
});

// GET /api/admin/stats — 平台总览统计
admin.get('/stats', async (c) => {
  const [totalLabs, totalUsers, totalAnimals, totalSubscriptions, activeSubscriptions] =
    await Promise.all([
      prisma.lab.count(),
      prisma.user.count(),
      prisma.animal.count(),
      prisma.subscription.count(),
      prisma.subscription.count({ where: { status: 'active' } }),
    ]);

  // 按套餐统计
  const planDistribution = await prisma.subscription.groupBy({
    by: ['planId'],
    _count: { id: true },
    where: { status: 'active' },
  });

  // 最近注册的实验室
  const recentLabs = await prisma.lab.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { users: true, animals: true } },
      subscription: true,
    },
  });

  return c.json({
    totalLabs,
    totalUsers,
    totalAnimals,
    totalSubscriptions,
    activeSubscriptions,
    planDistribution: planDistribution.map((p) => ({
      planId: p.planId,
      count: p._count.id,
    })),
    recentLabs: recentLabs.map((lab) => ({
      id: lab.id,
      name: lab.name,
      institution: lab.institution,
      createdAt: lab.createdAt,
      userCount: lab._count.users,
      animalCount: lab._count.animals,
      plan: lab.subscription?.planId || 'academic-free',
      subscriptionStatus: lab.subscription?.status || 'none',
    })),
  });
});

// GET /api/admin/labs — 所有实验室列表（含订阅和使用量）
admin.get('/labs', async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  const search = c.req.query('search') || '';

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { institution: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const [labs, total] = await Promise.all([
    prisma.lab.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { users: true, animals: true, protocols: true } },
        subscription: true,
      },
    }),
    prisma.lab.count({ where }),
  ]);

  return c.json({
    labs: labs.map((lab) => ({
      id: lab.id,
      name: lab.name,
      institution: lab.institution,
      createdAt: lab.createdAt,
      userCount: lab._count.users,
      animalCount: lab._count.animals,
      protocolCount: lab._count.protocols,
      subscription: lab.subscription
        ? {
            planId: lab.subscription.planId,
            status: lab.subscription.status,
            provider: lab.subscription.provider,
            currentPeriodEnd: lab.subscription.currentPeriodEnd,
          }
        : null,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

// GET /api/admin/subscriptions — 所有订阅概览
admin.get('/subscriptions', async (c) => {
  const subscriptions = await prisma.subscription.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      lab: {
        include: {
          _count: { select: { users: true, animals: true } },
        },
      },
    },
  });

  return c.json({
    subscriptions: subscriptions.map((sub) => ({
      id: sub.id,
      labId: sub.labId,
      labName: sub.lab.name,
      planId: sub.planId,
      status: sub.status,
      provider: sub.provider,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      userCount: sub.lab._count.users,
      animalCount: sub.lab._count.animals,
      createdAt: sub.createdAt,
    })),
  });
});

// GET /api/admin/labs/:id — 单个实验室详情
admin.get('/labs/:id', async (c) => {
  const labId = c.req.param('id');

  const lab = await prisma.lab.findUnique({
    where: { id: labId },
    include: {
      users: { include: { user: { select: { id: true, email: true, name: true, createdAt: true } } } },
      subscription: true,
      _count: {
        select: {
          animals: true,
          protocols: true,
          rooms: true,
          deathReports: true,
          apiKeys: true,
        },
      },
    },
  });

  if (!lab) {
    return c.json({ error: 'Lab not found' }, 404);
  }

  // 获取动物状态分布
  const animalStatusDistribution = await prisma.animal.groupBy({
    by: ['status'],
    where: { labId },
    _count: { id: true },
  });

  return c.json({
    id: lab.id,
    name: lab.name,
    institution: lab.institution,
    address: lab.address,
    createdAt: lab.createdAt,
    users: lab.users.map((ul) => ({
      id: ul.user.id,
      email: ul.user.email,
      name: ul.user.name,
      role: ul.role,
      joinedAt: ul.user.createdAt,
    })),
    subscription: lab.subscription,
    stats: {
      animals: lab._count.animals,
      protocols: lab._count.protocols,
      rooms: lab._count.rooms,
      deathReports: lab._count.deathReports,
      apiKeys: lab._count.apiKeys,
    },
    animalStatusDistribution: animalStatusDistribution.map((s) => ({
      status: s.status,
      count: s._count.id,
    })),
  });
});
