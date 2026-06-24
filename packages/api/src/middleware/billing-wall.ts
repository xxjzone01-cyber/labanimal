/**
 * Billing Wall 中间件
 *
 * 检查订阅状态和使用限额。遵循商业化 v2.2 决策：
 * - 超量 → 报告失去合规签名，而非阻断功能
 * - 免费版：500 动物 / 10 用户 / 3 报告/月
 * - 付费版：根据套餐限额
 *
 * 中间件不阻断请求，而是将限额信息注入 context，
 * 由路由自行决定超限时的行为（签名降级 vs 返回 403）。
 */

import type { Context, Next } from 'hono';
import { getUser } from './auth.js';
import { prisma } from '../lib/db.js';

/** 套餐限额定义 */
interface PlanLimits {
  maxAnimals: number;       // -1 = 无限
  maxUsers: number;         // -1 = 无限
  maxReportsPerMonth: number; // -1 = 无限
  hasApiAccess: boolean;
  hasAAALACSupport: boolean;
}

/** 免费版限额（开源版默认） */
const FREE_TIER_LIMITS: PlanLimits = {
  maxAnimals: 500,
  maxUsers: 10,
  maxReportsPerMonth: 3,
  hasApiAccess: false,
  hasAAALACSupport: false,
};

/** 套餐限额映射 */
const PLAN_LIMITS: Record<string, PlanLimits> = {
  'academic-free': FREE_TIER_LIMITS,
  'starter': {
    maxAnimals: 1000,
    maxUsers: 15,
    maxReportsPerMonth: -1,
    hasApiAccess: false,
    hasAAALACSupport: false,
  },
  'professional': {
    maxAnimals: 15000,
    maxUsers: 40,
    maxReportsPerMonth: -1,
    hasApiAccess: true,
    hasAAALACSupport: false,
  },
  'enterprise-saas': {
    maxAnimals: -1,
    maxUsers: -1,
    maxReportsPerMonth: -1,
    hasApiAccess: true,
    hasAAALACSupport: true,
  },
  'enterprise-self-hosted': {
    maxAnimals: -1,
    maxUsers: -1,
    maxReportsPerMonth: 20,
    hasApiAccess: true,
    hasAAALACSupport: true,
  },
};

/** 使用量统计 */
export interface UsageStats {
  animalCount: number;
  userCount: number;
  reportsThisMonth: number;
}

/** Billing Wall 注入的 context */
export interface BillingContext {
  plan: string;
  limits: PlanLimits;
  usage: UsageStats;
  isOverLimit: boolean;
  overLimitReasons: string[];
}

/**
 * Billing Wall 中间件
 *
 * 计算当前 lab 的使用量和限额，注入到 context 中。
 * 不阻断请求，由路由自行决定超限时的行为。
 */
export async function billingWallMiddleware(c: Context, next: Next): Promise<void> {
  const user = getUser(c);

  // 如果没有 labId，跳过 billing check
  if (!user.labId) {
    await next();
    return;
  }

  // 获取 lab 的订阅信息
  const lab = await prisma.lab.findUnique({
    where: { id: user.labId },
    select: { id: true },
  });

  if (!lab) {
    await next();
    return;
  }

  // 从数据库读取实际订阅套餐
  const subscription = await prisma.subscription.findUnique({
    where: { labId: user.labId },
    select: { planId: true, status: true },
  });

  // 有效订阅状态：active, 或免费版无订阅记录
  const plan = subscription?.status === 'active'
    ? subscription.planId
    : 'academic-free';
  const limits = PLAN_LIMITS[plan] || FREE_TIER_LIMITS;

  // 统计使用量
  const [animalCount, userCount] = await Promise.all([
    prisma.animal.count({
      where: { labId: user.labId, status: { notIn: ['deceased', 'retired'] } },
    }),
    prisma.userLab.count({
      where: { labId: user.labId },
    }),
  ]);

  // 本月报告数
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

  // 检查超限
  const overLimitReasons: string[] = [];
  if (limits.maxAnimals !== -1 && animalCount > limits.maxAnimals) {
    overLimitReasons.push(`Animal limit exceeded: ${animalCount}/${limits.maxAnimals}`);
  }
  if (limits.maxUsers !== -1 && userCount > limits.maxUsers) {
    overLimitReasons.push(`User limit exceeded: ${userCount}/${limits.maxUsers}`);
  }
  if (limits.maxReportsPerMonth !== -1 && reportsThisMonth >= limits.maxReportsPerMonth) {
    overLimitReasons.push(`Monthly report limit reached: ${reportsThisMonth}/${limits.maxReportsPerMonth}`);
  }

  const billingCtx: BillingContext = {
    plan,
    limits,
    usage,
    isOverLimit: overLimitReasons.length > 0,
    overLimitReasons,
  };

  c.set('billing', billingCtx);
  await next();
}

/**
 * 获取 billing context
 */
export function getBilling(c: Context): BillingContext {
  return c.get('billing') as BillingContext;
}

/**
 * 检查是否可以签名报告（月度限制）
 * 超限时返回 false，路由应生成 unverified 签名
 */
export function canSignReport(c: Context): boolean {
  const billing = getBilling(c);
  if (!billing) return true; // 无 billing context 时允许
  if (billing.limits.maxReportsPerMonth === -1) return true; // 无限
  return billing.usage.reportsThisMonth < billing.limits.maxReportsPerMonth;
}

/**
 * 获取套餐限额
 */
export function getPlanLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[plan] || FREE_TIER_LIMITS;
}
