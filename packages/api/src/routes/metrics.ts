/**
 * 监控端点
 *
 * GET /api/health  — 增强版：含 DB 连通性检查（readiness）
 * GET /api/metrics — 指标数据（可选 CRON_SECRET 保护）
 * GET /api/alerts  — 告警检查（CRON_SECRET 保护，供定时调用）
 */

import { Hono } from 'hono';
import { getMetrics, checkAlerts } from '../lib/monitor.js';
import { prisma } from '../lib/db.js';
import { sendAlertEmail } from '../lib/alerts.js';

const metrics = new Hono();

// 从 package.json 读取版本号
let appVersion = 'unknown';
try {
  const pkg = await import('../../package.json', { with: { type: 'json' } });
  appVersion = (pkg as any).default?.version ?? (pkg as any).version ?? 'unknown';
} catch {
  // 构建后可能找不到 package.json
}

// 增强版 health check — 含 DB 连通性
metrics.get('/health', async (c) => {
  const checks: Record<string, string> = {};
  let dbHealthy = true;

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'failed';
    dbHealthy = false;
  }

  const status = dbHealthy ? 'ok' : 'degraded';
  const httpStatus = dbHealthy ? 200 : 503;

  return c.json({
    status,
    version: appVersion,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks,
  }, httpStatus);
});

// 指标数据
metrics.get('/metrics', async (c) => {
  // 可选认证
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = c.req.header('Authorization');
    const provided = authHeader?.replace('Bearer ', '') || c.req.header('X-Cron-Secret');
    if (provided !== cronSecret) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
  }

  const data = getMetrics();
  return c.json(data);
});

// 告警检查 — 供定时调用
metrics.post('/alerts/check', async (c) => {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = c.req.header('Authorization');
    const provided = authHeader?.replace('Bearer ', '');
    if (provided !== cronSecret) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
  }

  // 检查 DB 连通性
  let dbHealthy = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbHealthy = false;
  }

  const alerts = checkAlerts(dbHealthy);

  // 发送告警邮件（如果有）
  if (alerts.length > 0) {
    sendAlertEmail(alerts);
  }

  return c.json({
    status: alerts.length > 0 ? 'alert' : 'ok',
    alerts,
    dbHealthy,
    timestamp: new Date().toISOString(),
  });
});

export { metrics };
