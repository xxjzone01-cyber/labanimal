/**
 * Stripe 订阅套餐配置
 */

/** Stripe 订阅套餐定义 */
export interface StripePlan {
  name: string;
  priceId: string;
  annualPriceId?: string;
  monthlyPrice: number;
  maxAnimals: number;
  maxUsers: number;
  maxReportsPerMonth: number;
  hasApiAccess: boolean;
  hasAAALACSupport: boolean;
}

/** 订阅套餐配置 */
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
  starter: {
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
  professional: {
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
