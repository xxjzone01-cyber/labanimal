import { createRequire } from 'node:module';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };
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
import { billing } from './routes/billing.js';
import { batchSessions } from './routes/batch-sessions.js';
import { labs } from './routes/labs.js';
import { license } from './routes/license.js';
import { subscriptions } from './routes/subscriptions.js';
import { stripe } from './routes/stripe.js';
import { apiKeys } from './routes/api-keys.js';
import { admin } from './routes/admin.js';

const app = new Hono();

// CORS 配置：支持逗号分隔的多域名白名单
const corsOrigin = process.env.CORS_ORIGIN;
if (process.env.NODE_ENV === 'production' && (!corsOrigin || corsOrigin === '*')) {
  console.warn('[WARN] CORS_ORIGIN not set in production — allowing all origins. Set CORS_ORIGIN=https://your-domain.com');
}

// Global middleware
app.use('*', logger());
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

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', version, timestamp: new Date().toISOString() });
});

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
app.route('/api/billing', billing);
app.route('/api/batch-sessions', batchSessions);
app.route('/api/license', license);
app.route('/api/subscriptions', subscriptions);
app.route('/api/stripe', stripe);
app.route('/api/api-keys', apiKeys);
app.route('/api/admin', admin);

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
}

export default app;
