/**
 * Billing Wall 中间件
 *
 * 检查订阅状态和使用限额。遵循商业化 v2.2 决策：
 * - 超量 → 报告失去合规签名，而非阻断功能
 * - 免费版：500 动物 / 10 用户 / 3 报告/月
 *
 * 中间件不阻断请求，而是将限额信息注入 context，
 * 由路由自行决定超限时的行为（签名降级 vs 返回 403）。
 */

import type { Context, Next } from 'hono';
import {
  computeBillingContext,
  canSignReport as _canSignReport,
  type BillingContext,
  type UsageStats,
} from './index.js';

export type { BillingContext, UsageStats } from './index.js';

/** Prisma 客户端接口（最小依赖） */
export interface PrismaClient {
  [key: string]: any;
}

/** 用户信息接口 */
export interface UserInfo {
  userId: string;
  labId?: string;
  email?: string;
}

/** 依赖注入接口 */
export interface BillingWallDeps {
  prisma: PrismaClient;
  getUser: (c: Context) => UserInfo;
}

/**
 * 创建 Billing Wall 中间件（依赖注入模式）
 */
export function createBillingWallMiddleware(deps: BillingWallDeps) {
  const { prisma, getUser } = deps;

  return async function billingWallMiddleware(c: Context, next: Next): Promise<void> {
    const user = getUser(c);

    if (!user.labId) {
      await next();
      return;
    }

    const lab = await prisma.lab.findUnique({
      where: { id: user.labId },
      select: { id: true },
    });

    if (!lab) {
      await next();
      return;
    }

    const subscription = await prisma.subscription.findUnique({
      where: { labId: user.labId },
      select: { planId: true, status: true },
    });

    const plan = subscription?.status === 'active' ? subscription.planId : 'academic-free';

    const [animalCount, userCount] = await Promise.all([
      prisma.animal.count({
        where: { labId: user.labId, status: { notIn: ['deceased', 'retired'] } },
      }),
      prisma.userLab.count({
        where: { labId: user.labId },
      }),
    ]);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const reportsThisMonth = await prisma.auditLog.count({
      where: {
        labId: user.labId,
        action: 'REPORT_SIGN',
        createdAt: { gte: monthStart, lte: monthEnd },
      },
    });

    const usage: UsageStats = { animalCount, userCount, reportsThisMonth };
    const billingCtx = computeBillingContext(plan, usage);

    c.set('billing', billingCtx);
    await next();
  };
}

/**
 * 获取 billing context
 */
export function getBilling(c: Context): BillingContext {
  return c.get('billing') as BillingContext;
}

/**
 * 检查是否可以签名报告（月度限制）
 */
export function canSignReport(c: Context): boolean {
  const billing = getBilling(c);
  return _canSignReport(billing);
}
