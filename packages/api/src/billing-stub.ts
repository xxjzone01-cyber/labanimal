/**
 * 开源版 Billing Stub
 *
 * 当 @labanimal/billing（闭源包）不可用时，
 * 提供 academic-free 默认行为。
 */

import type { Context, Next } from 'hono';

/** 套餐限额定义 */
interface PlanLimits {
  maxAnimals: number;
  maxUsers: number;
  maxReportsPerMonth: number;
  hasApiAccess: boolean;
  hasAAALACSupport: boolean;
}

/** Billing 上下文 */
interface BillingContext {
  plan: string;
  limits: PlanLimits;
  usage: { animalCount: number; userCount: number; reportsThisMonth: number };
  isOverLimit: boolean;
  overLimitReasons: string[];
}

const DEFAULT_LIMITS: PlanLimits = {
  maxAnimals: 500,
  maxUsers: 10,
  maxReportsPerMonth: 3,
  hasApiAccess: false,
  hasAAALACSupport: false,
};

const DEFAULT_BILLING: BillingContext = {
  plan: 'academic-free',
  limits: DEFAULT_LIMITS,
  usage: { animalCount: 0, userCount: 0, reportsThisMonth: 0 },
  isOverLimit: false,
  overLimitReasons: [],
};

/** 中间件：注入默认 billing context */
export async function billingWallMiddleware(c: Context, next: Next): Promise<void> {
  c.set('billing', DEFAULT_BILLING);
  await next();
}

/** 获取 billing context */
export function getBilling(c: Context): BillingContext {
  return (c.get('billing') as BillingContext) ?? DEFAULT_BILLING;
}

/** 开源版始终允许签名（未超限） */
export function canSignReport(_c: Context): boolean {
  return true;
}

/** 获取套餐限额 */
export function getPlanLimits(_plan?: string): PlanLimits {
  return DEFAULT_LIMITS;
}
