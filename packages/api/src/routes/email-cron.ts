/**
 * 邮件定时任务 HTTP 端点
 *
 * POST /api/email-cron/check — 用 CRON_SECRET 环境变量保护
 * POST /api/email-cron/check-expiry — 兼容旧端点
 */

import { Hono } from 'hono';
import { runAllChecks } from '../lib/email-scheduler.js';

const emailCron = new Hono();

async function handleCheck(c: any) {
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const authHeader = c.req.header('Authorization');
    const provided = authHeader?.replace('Bearer ', '') || c.req.header('X-Cron-Secret');
    if (provided !== cronSecret) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
  }

  try {
    const result = await runAllChecks();
    return c.json({ status: 'ok', ...result, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('[Cron] Email check failed:', err);
    return c.json({ error: 'Check failed' }, 500);
  }
}

emailCron.post('/check', handleCheck);
emailCron.post('/check-expiry', handleCheck);

export { emailCron };
