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
import { billing } from './routes/billing.js';
import { batchSessions } from './routes/batch-sessions.js';
import { labs } from './routes/labs.js';
import { license } from './routes/license.js';

const app = new Hono();

// Global middleware
app.use('*', logger());
app.use('*', cors({
  origin: process.env.CORS_ORIGIN || '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', version: '0.1.0', timestamp: new Date().toISOString() });
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

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  // Malformed JSON body
  if (err instanceof SyntaxError && err.message.includes('JSON')) {
    return c.json({ error: 'Invalid JSON in request body' }, 400);
  }
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

// Start server
const port = parseInt(process.env.PORT || '3001', 10);

console.log(`LabAnimal API starting on port ${port}...`);

// Node.js serve
import { serve } from '@hono/node-server';

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`LabAnimal API running at http://localhost:${info.port}`);
});

export default app;
