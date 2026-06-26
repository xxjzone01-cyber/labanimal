/**
 * @labanimal/billing — 计费与订阅核心逻辑
 *
 * 纯业务逻辑包，不含 HTTP 框架依赖。
 * 可独立发布为私有 npm 包。
 */

/** 套餐限额定义 */
export interface PlanLimits {
  maxAnimals: number; // -1 = 无限
  maxUsers: number; // -1 = 无限
  maxReportsPerMonth: number; // -1 = 无限
  hasApiAccess: boolean;
  hasAAALACSupport: boolean;
}

/** 使用量统计 */
export interface UsageStats {
  animalCount: number;
  userCount: number;
  reportsThisMonth: number;
}

/** Billing 上下文 */
export interface BillingContext {
  plan: string;
  limits: PlanLimits;
  usage: UsageStats;
  isOverLimit: boolean;
  overLimitReasons: string[];
}

/** 免费版限额（开源版默认） */
export const FREE_TIER_LIMITS: PlanLimits = {
  maxAnimals: 500,
  maxUsers: 10,
  maxReportsPerMonth: 3,
  hasApiAccess: false,
  hasAAALACSupport: false,
};

/** 套餐限额映射 */
export const PLAN_LIMITS: Record<string, PlanLimits> = {
  'academic-free': FREE_TIER_LIMITS,
  starter: {
    maxAnimals: 1000,
    maxUsers: 15,
    maxReportsPerMonth: -1,
    hasApiAccess: false,
    hasAAALACSupport: false,
  },
  professional: {
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

/** 年付折扣百分比 */
export const ANNUAL_DISCOUNT_PERCENT = 10;

/**
 * 获取套餐限额
 */
export function getPlanLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[plan] || FREE_TIER_LIMITS;
}

/**
 * 根据使用量计算 billing 上下文
 */
export function computeBillingContext(
  plan: string,
  usage: UsageStats,
): BillingContext {
  const limits = getPlanLimits(plan);

  const overLimitReasons: string[] = [];
  if (limits.maxAnimals !== -1 && usage.animalCount > limits.maxAnimals) {
    overLimitReasons.push(`Animal limit exceeded: ${usage.animalCount}/${limits.maxAnimals}`);
  }
  if (limits.maxUsers !== -1 && usage.userCount > limits.maxUsers) {
    overLimitReasons.push(`User limit exceeded: ${usage.userCount}/${limits.maxUsers}`);
  }
  if (
    limits.maxReportsPerMonth !== -1 &&
    usage.reportsThisMonth >= limits.maxReportsPerMonth
  ) {
    overLimitReasons.push(
      `Monthly report limit reached: ${usage.reportsThisMonth}/${limits.maxReportsPerMonth}`,
    );
  }

  return {
    plan,
    limits,
    usage,
    isOverLimit: overLimitReasons.length > 0,
    overLimitReasons,
  };
}

/**
 * 检查是否可以签名报告（月度限制）
 * 超限时返回 false，调用方应生成 unverified 签名
 */
export function canSignReport(billing: BillingContext | null): boolean {
  if (!billing) return true;
  if (billing.limits.maxReportsPerMonth === -1) return true;
  return billing.usage.reportsThisMonth < billing.limits.maxReportsPerMonth;
}
