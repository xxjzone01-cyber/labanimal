/**
 * Stripe 订阅套餐配置
 *
 * 套餐 ID 和价格 ID 来自 Stripe Dashboard。
 * 测试环境和生产环境使用不同的 key。
 */

/** Stripe 订阅套餐定义 */
export interface StripePlan {
  /** 套餐名称 */
  name: string;
  /** Stripe Price ID（月付，从 Stripe Dashboard 获取） */
  priceId: string;
  /** Stripe Price ID（年付，可选） */
  annualPriceId?: string;
  /** 月价格（美元，显示用） */
  monthlyPrice: number;
  /** 动物上限 */
  maxAnimals: number;
  /** 用户上限 */
  maxUsers: number;
  /** 报告限制（-1 = 无限） */
  maxReportsPerMonth: number;
  /** 是否包含 API 访问 */
  hasApiAccess: boolean;
  /** 是否包含 AAALAC 审计包 */
  hasAAALACSupport: boolean;
}

/**
 * 订阅套餐配置
 *
 * priceId 需要在 Stripe Dashboard 中创建产品和价格后填入。
 * 格式：price_xxxxx（测试环境）或 price_xxxxx（生产环境）
 */
export const STRIPE_PLANS: Record<string, StripePlan> = {
  'academic-free': {
    name: 'Academic Free',
    priceId: process.env.STRIPE_PRICE_ACADEMIC_FREE || '',
    monthlyPrice: 0,
    maxAnimals: 500,
    maxUsers: 10,
    maxReportsPerMonth: 3,
    hasApiAccess: false,
    hasAAALACSupport: false,
  },
  'starter': {
    name: 'Starter',
    priceId: process.env.STRIPE_PRICE_STARTER || '',
    annualPriceId: process.env.STRIPE_PRICE_STARTER_ANNUAL || '',
    monthlyPrice: 99,
    maxAnimals: 1000,
    maxUsers: 15,
    maxReportsPerMonth: -1,
    hasApiAccess: false,
    hasAAALACSupport: false,
  },
  'professional': {
    name: 'Professional',
    priceId: process.env.STRIPE_PRICE_PROFESSIONAL || '',
    annualPriceId: process.env.STRIPE_PRICE_PROFESSIONAL_ANNUAL || '',
    monthlyPrice: 299,
    maxAnimals: 15000,
    maxUsers: 40,
    maxReportsPerMonth: -1,
    hasApiAccess: true,
    hasAAALACSupport: false,
  },
  'enterprise-saas': {
    name: 'Enterprise SaaS',
    priceId: process.env.STRIPE_PRICE_ENTERPRISE_SAAS || '',
    annualPriceId: process.env.STRIPE_PRICE_ENTERPRISE_SAAS_ANNUAL || '',
    monthlyPrice: 499,
    maxAnimals: -1,
    maxUsers: -1,
    maxReportsPerMonth: -1,
    hasApiAccess: true,
    hasAAALACSupport: true,
  },
};

/** 年付折扣比例 */
export const ANNUAL_DISCOUNT_PERCENT = 10;

/** Stripe 必需的环境变量 */
export const STRIPE_REQUIRED_ENV = [
  'STRIPE_SECRET_KEY',
  'STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET',
] as const;
