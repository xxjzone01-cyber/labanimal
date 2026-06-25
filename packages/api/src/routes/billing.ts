import { Hono } from 'hono';
import { prisma } from '../lib/db.js';
import { authMiddleware, getUser } from '../middleware/auth.js';
import { getPlanLimits } from '../middleware/billing-wall.js';

const billing = new Hono();

billing.use('*', authMiddleware);

// GET /api/billing/generate — generate per diem billing report
billing.get('/generate', async (c) => {
  const user = getUser(c);
  const labId = c.req.query('labId');
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');

  if (!labId) {
    return c.json({ error: 'labId query parameter is required' }, 400);
  }
  if (!startDate || !endDate) {
    return c.json({ error: 'startDate and endDate query parameters are required (YYYY-MM-DD)' }, 400);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId } },
  });
  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end <= start) {
    return c.json({ error: 'endDate must be after startDate' }, 400);
  }

  // Get rates for this lab
  const rates = await prisma.rate.findMany({ where: { labId } });
  const rateMap = new Map(rates.map(r => [r.species, r]));

  // Count active animals per species
  const animals = await prisma.animal.groupBy({
    by: ['species'],
    where: {
      labId,
      status: { notIn: ['deceased', 'retired'] },
      createdAt: { lte: end },
    },
    _count: { id: true },
  });

  // Count occupied cages
  const occupiedCages = await prisma.cage.count({
    where: {
      rack: { room: { labId } },
      animals: { some: {} },
    },
  });

  // Calculate days
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  // Build line items
  const lineItems: Array<{
    type: 'animal' | 'cage';
    species?: string;
    count: number;
    dailyRate: number;
    days: number;
    subtotal: number;
  }> = [];

  let totalAnimalCost = 0;
  let totalCageCost = 0;

  for (const group of animals) {
    const rate = rateMap.get(group.species);
    if (rate) {
      const subtotal = group._count.id * rate.dailyRate * days;
      lineItems.push({
        type: 'animal',
        species: group.species,
        count: group._count.id,
        dailyRate: rate.dailyRate,
        days,
        subtotal,
      });
      totalAnimalCost += subtotal;
    }
  }

  // Cage costs (use average cage rate across species, or first available)
  const cageRate = rates.find(r => r.cageRate)?.cageRate || 0;
  if (cageRate > 0 && occupiedCages > 0) {
    const subtotal = occupiedCages * cageRate * days;
    lineItems.push({
      type: 'cage',
      count: occupiedCages,
      dailyRate: cageRate,
      days,
      subtotal,
    });
    totalCageCost = subtotal;
  }

  return c.json({
    labId,
    period: { startDate, endDate, days },
    lineItems,
    summary: {
      animalCost: totalAnimalCost,
      cageCost: totalCageCost,
      total: totalAnimalCost + totalCageCost,
    },
  });
});

// GET /api/billing/usage — 获取当前 lab 的使用量和套餐信息
billing.get('/usage', async (c) => {
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

  // 获取订阅信息
  const subscription = await prisma.subscription.findUnique({
    where: { labId },
    select: { planId: true, status: true, provider: true, currentPeriodEnd: true, cancelAtPeriodEnd: true },
  });

  const plan = subscription?.status === 'active' ? subscription.planId : 'academic-free';
  const limits = getPlanLimits(plan);

  // 统计使用量
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const [animalCount, userCount, reportsThisMonth, roomCount, protocolCount] = await Promise.all([
    prisma.animal.count({
      where: { labId, status: { notIn: ['deceased', 'retired'] } },
    }),
    prisma.userLab.count({ where: { labId } }),
    prisma.auditLog.count({
      where: { labId, action: 'REPORT_SIGN', createdAt: { gte: monthStart, lte: monthEnd } },
    }),
    prisma.room.count({ where: { labId } }),
    prisma.protocol.count({ where: { labId } }),
  ]);

  const overLimitReasons: string[] = [];
  if (limits.maxAnimals !== -1 && animalCount > limits.maxAnimals) {
    overLimitReasons.push(`动物数量超限: ${animalCount}/${limits.maxAnimals}`);
  }
  if (limits.maxUsers !== -1 && userCount > limits.maxUsers) {
    overLimitReasons.push(`用户数量超限: ${userCount}/${limits.maxUsers}`);
  }
  if (limits.maxReportsPerMonth !== -1 && reportsThisMonth >= limits.maxReportsPerMonth) {
    overLimitReasons.push(`月度报告限额已达: ${reportsThisMonth}/${limits.maxReportsPerMonth}`);
  }

  return c.json({
    plan,
    subscription: subscription || { planId: 'academic-free', status: 'active', provider: 'free' },
    limits,
    usage: { animalCount, userCount, reportsThisMonth, roomCount, protocolCount },
    isOverLimit: overLimitReasons.length > 0,
    overLimitReasons,
  });
});

export { billing };
