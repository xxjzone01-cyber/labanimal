/**
 * 监控中间件 — 记录请求指标
 *
 * 自动记录每个请求的状态码和响应时间。
 */

import type { Context, Next } from 'hono';
import { recordRequest, incrementConnections, decrementConnections } from '../lib/monitor.js';

export async function monitorMiddleware(c: Context, next: Next): Promise<void> {
  incrementConnections();
  const start = performance.now();

  try {
    await next();
  } finally {
    const elapsed = performance.now() - start;
    recordRequest(c.res.status, elapsed);
    decrementConnections();
  }
}
