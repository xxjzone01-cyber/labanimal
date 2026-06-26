/**
 * 速率限制中间件
 *
 * 基于内存的滑动窗口计数器，用于防止暴力破解。
 * 按 IP 地址限制请求频率。
 */

import type { Context, Next } from 'hono';

/** 速率限制配置 */
interface RateLimitConfig {
  /** 时间窗口（毫秒） */
  windowMs: number;
  /** 窗口内最大请求数 */
  maxRequests: number;
}

/** IP 请求记录 */
interface RequestRecord {
  timestamps: number[];
}

/** 内存存储（生产环境应使用 Redis） */
const store = new Map<string, RequestRecord>();

/** 定期清理过期记录（每 5 分钟） */
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of store) {
    // 移除所有已过期的时间戳
    record.timestamps = record.timestamps.filter((ts) => ts > now - 60_000);
    if (record.timestamps.length === 0) {
      store.delete(key);
    }
  }
}, 5 * 60_000);

/**
 * 创建速率限制中间件
 */
export function rateLimit(config: RateLimitConfig) {
  return async (c: Context, next: Next) => {
    // 测试环境跳过速率限制
    if (process.env.DISABLE_RATE_LIMIT === 'true') {
      return next();
    }

    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      c.req.header('x-real-ip') ||
      'unknown';
    const key = `${ip}:${c.req.path}`;
    const now = Date.now();

    let record = store.get(key);
    if (!record) {
      record = { timestamps: [] };
      store.set(key, record);
    }

    // 清除窗口外的旧记录
    record.timestamps = record.timestamps.filter((ts) => ts > now - config.windowMs);

    if (record.timestamps.length >= config.maxRequests) {
      c.header('Retry-After', String(Math.ceil(config.windowMs / 1000)));
      return c.json({ error: 'Too many requests. Please try again later.' }, 429);
    }

    record.timestamps.push(now);
    return next();
  };
}

/** 登录端点限制：5 次/分钟 */
export const loginRateLimit = rateLimit({ windowMs: 60_000, maxRequests: 5 });

/** 注册端点限制：3 次/分钟 */
export const registerRateLimit = rateLimit({ windowMs: 60_000, maxRequests: 3 });
