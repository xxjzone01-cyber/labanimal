import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import { auth } from './routes/auth.js';
import { animals } from './routes/animals.js';
import { rooms } from './routes/rooms.js';
import { protocols } from './routes/protocols.js';
import { healthRecords } from './routes/health-records.js';
import { deathReports } from './routes/death-reports.js';
import { medications } from './routes/medications.js';
import { animalIdentifiers } from './routes/animal-identifiers.js';
import { animalLinks } from './routes/animal-links.js';
import { breedings } from './routes/breedings.js';
import { racks } from './routes/racks.js';
import { cages } from './routes/cages.js';
import { auditLog } from './routes/audit-log.js';
import { trainings } from './routes/trainings.js';
import { workSessions } from './routes/work-sessions.js';
import { enrichments } from './routes/enrichments.js';
import { rates } from './routes/rates.js';
import { electronicSignatures } from './routes/electronic-signatures.js';
import { batchSessions } from './routes/batch-sessions.js';
import { labs } from './routes/labs.js';
import { license } from './routes/license.js';
import { apiKeys } from './routes/api-keys.js';
import { admin } from './routes/admin.js';
import { emailCron } from './routes/email-cron.js';
import { metrics } from './routes/metrics.js';
import { sendSubscriptionConfirmation } from './lib/email/send.js';
import { startScheduler } from './lib/email-scheduler.js';
import { startMonitor } from './lib/monitor.js';
import { monitorMiddleware } from './middleware/monitor.js';

// 条件加载 billing 路由：闭源包可用时使用完整实现，否则使用 stub
let billingRoutes: any, stripeRoutes: any, subscriptionsRoutes: any;
try {
  const billing = await import('@labanimal/billing');
  const prisma = (await import('./lib/db.js')).prisma;
  const { getUser } = await import('./middleware/auth.js');
  const deps = {
    prisma,
    getUser,
    onSubscriptionActivated: async (labId: string, planId: string) => {
      try {
        // 查 lab 管理员邮箱，发订阅确认邮件
        const lab = await prisma.lab.findUnique({
          where: { id: labId },
          select: {
            name: true,
            users: {
              where: { role: 'admin' },
              select: { user: { select: { email: true, name: true } } },
            },
          },
        });
        if (!lab) return;

        const planNames: Record<string, string> = {
          starter: 'Starter',
          professional: 'Professional',
          'enterprise-saas': 'Enterprise SaaS',
        };
        const planName = planNames[planId] || planId;
        const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString();

        for (const membership of lab.users) {
          const user = membership.user;
          if (!user?.email) continue;
          sendSubscriptionConfirmation(user.email, {
            userName: user.name || 'User',
            planName,
            amount: planId === 'starter' ? '$99/mo' : planId === 'professional' ? '$299/mo' : '$499/mo',
            periodEnd,
          });
        }
      } catch (err) {
        console.error('[Billing] Failed to send subscription confirmation:', err);
      }
    },
  };
  billingRoutes = billing.createBillingRoutes(deps);
  stripeRoutes = billing.createStripeRoutes(deps);
  subscriptionsRoutes = billing.createSubscriptionsRoutes(deps);
  console.log('[Billing] Loaded @labanimal/billing (full)');
} catch {
  const { createStubRoutes } = await import('./billing-stub-routes.js');
  const stubs = createStubRoutes();
  billingRoutes = stubs.billing;
  stripeRoutes = stubs.stripe;
  subscriptionsRoutes = stubs.subscriptions;
  console.log('[Billing] @labanimal/billing not found, using open-source stubs');
}

const app = new Hono();

// CORS 配置：支持逗号分隔的多域名白名单
const corsOrigin = process.env.CORS_ORIGIN;
if (process.env.NODE_ENV === 'production' && (!corsOrigin || corsOrigin === '*')) {
  console.warn('[WARN] CORS_ORIGIN not set in production — allowing all origins. Set CORS_ORIGIN=https://your-domain.com');
}

// Global middleware
app.use('*', logger());
app.use('*', monitorMiddleware);
app.use(
  '*',
  cors({
    origin: corsOrigin
      ? corsOrigin.split(',').map((o) => o.trim())
      : '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Lab-Id'],
    maxAge: 86400,
  }),
);

// Health check + Metrics + Alerts
app.route('/api', metrics);

// Routes
app.route('/api/auth', auth);
app.route('/api/labs', labs);
app.route('/api/animals', animals);
app.route('/api/rooms', rooms);
app.route('/api/protocols', protocols);
app.route('/api/health-records', healthRecords);
app.route('/api/death-reports', deathReports);
app.route('/api/medications', medications);
app.route('/api/animal-identifiers', animalIdentifiers);
app.route('/api/animal-links', animalLinks);
app.route('/api/breedings', breedings);
app.route('/api/racks', racks);
app.route('/api/cages', cages);
app.route('/api/audit-log', auditLog);
app.route('/api/trainings', trainings);
app.route('/api/work-sessions', workSessions);
app.route('/api/enrichments', enrichments);
app.route('/api/rates', rates);
app.route('/api/electronic-signatures', electronicSignatures);
app.route('/api/billing', billingRoutes);
app.route('/api/batch-sessions', batchSessions);
app.route('/api/license', license);
app.route('/api/subscriptions', subscriptionsRoutes);
app.route('/api/stripe', stripeRoutes);
app.route('/api/api-keys', apiKeys);
app.route('/api/admin', admin);
app.route('/api/email-cron', emailCron);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  // Hono HTTPException (validation errors, auth errors, etc.)
  if ('status' in err && typeof (err as any).status === 'number') {
    return c.json({ error: err.message }, (err as any).status);
  }
  // Malformed JSON body
  if (err instanceof SyntaxError && err.message.includes('JSON')) {
    return c.json({ error: 'Invalid JSON in request body' }, 400);
  }
  // 生产环境隐藏错误详情，开发环境输出堆栈
  if (process.env.NODE_ENV === 'production') {
    console.error('[ERROR]', err.message);
    return c.json({ error: 'Internal server error' }, 500);
  }
  console.error('Unhandled error:', err);
  return c.json({ error: err.message || 'Internal server error' }, 500);
});

// Node.js serve — 仅在非测试环境启动
import { serve } from '@hono/node-server';

if (!process.env.VITEST && !process.env.JEST_WORKER_ID) {
  const port = parseInt(process.env.PORT || '3001', 10);
  console.log(`LabAnimal API starting on port ${port}...`);
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`LabAnimal API running at http://localhost:${info.port}`);
  });
  startScheduler();
  startMonitor();
}

export default app;
