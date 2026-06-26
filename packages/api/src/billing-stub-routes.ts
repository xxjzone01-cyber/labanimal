/**
 * 开源版 Billing Stub 路由
 *
 * 当 @labanimal/billing（闭源包）不可用时，
 * 提供最小化路由：只读查询返回默认值，支付端点返回 400。
 */

import { Hono } from 'hono';
import { prisma } from './lib/db.js';
import { getUser } from './middleware/auth.js';

const MSG = 'Billing not available in open-source edition. Install @labanimal/billing for full functionality.';

/** Billing 路由 stub */
function createBillingStub() {
  const billing = new Hono();

  billing.get('/usage', async (c) => {
    const user = getUser(c);
    const labId = c.req.query('labId');

    if (!labId) return c.json({ error: 'labId query parameter is required' }, 400);

    const membership = await prisma.userLab.findUnique({
      where: { userId_labId: { userId: user.userId, labId } },
    });
    if (!membership) return c.json({ error: 'Access denied' }, 403);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [animalCount, userCount, reportsThisMonth] = await Promise.all([
      prisma.animal.count({ where: { labId, status: { notIn: ['deceased', 'retired'] } } }),
      prisma.userLab.count({ where: { labId } }),
      prisma.auditLog.count({ where: { labId, action: 'REPORT_SIGN', createdAt: { gte: monthStart, lte: monthEnd } } }),
    ]);

    return c.json({
      plan: 'academic-free',
      subscription: { planId: 'academic-free', status: 'active', provider: 'free' },
      limits: { maxAnimals: 500, maxUsers: 10, maxReportsPerMonth: 3, hasApiAccess: false, hasAAALACSupport: false },
      usage: { animalCount, userCount, reportsThisMonth },
      isOverLimit: false,
      overLimitReasons: [],
    });
  });

  billing.get('/generate', async (c) => {
    return c.json({ message: MSG }, 400);
  });

  return billing;
}

/** Stripe 路由 stub */
function createStripeStub() {
  const stripe = new Hono();

  stripe.get('/config', (c) => {
    return c.json({ publishableKey: '', plans: [] });
  });

  stripe.post('/create', (c) => {
    return c.json({ error: MSG }, 400);
  });

  stripe.post('/webhook', (c) => {
    return c.json({ error: MSG }, 400);
  });

  return stripe;
}

/** Subscriptions 路由 stub */
function createSubscriptionsStub() {
  const subscriptions = new Hono();

  subscriptions.post('/create', (c) => c.json({ error: MSG }, 400));
  subscriptions.post('/activate', (c) => c.json({ error: MSG }, 400));
  subscriptions.post('/cancel', (c) => c.json({ error: MSG }, 400));
  subscriptions.get('/status', (c) => c.json({ plan: 'academic-free', status: 'active', provider: 'free' }));
  subscriptions.post('/webhook', (c) => c.json({ error: MSG }, 400));

  return subscriptions;
}

/** 创建所有 stub 路由 */
export function createStubRoutes() {
  return {
    billing: createBillingStub(),
    stripe: createStripeStub(),
    subscriptions: createSubscriptionsStub(),
  };
}
