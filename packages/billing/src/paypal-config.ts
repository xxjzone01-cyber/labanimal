/**
 * PayPal 订阅配置
 *
 * 沙箱/生产环境通过环境变量切换。
 * 订阅套餐 ID 在 PayPal Dashboard 创建后填入。
 */

/** PayPal 订阅套餐定义 */
export interface PayPalPlan {
  name: string;
  paypalPlanId: string;
  monthlyPrice: number;
  maxAnimals: number;
  maxUsers: number;
  maxReportsPerMonth: number;
  hasApiAccess: boolean;
  hasAAALACSupport: boolean;
}

/** PayPal 套餐配置 */
export const PAYPAL_PLANS: Record<string, PayPalPlan> = {
  'academic-free': {
    name: 'Academic Free',
    paypalPlanId: process.env.PAYPAL_PLAN_ACADEMIC_FREE ?? '',
    monthlyPrice: 0,
    maxAnimals: 500,
    maxUsers: 10,
    maxReportsPerMonth: 3,
    hasApiAccess: false,
    hasAAALACSupport: false,
  },
  starter: {
    name: 'Starter',
    paypalPlanId: process.env.PAYPAL_PLAN_STARTER ?? '',
    monthlyPrice: 99,
    maxAnimals: 1000,
    maxUsers: 15,
    maxReportsPerMonth: -1,
    hasApiAccess: false,
    hasAAALACSupport: false,
  },
  professional: {
    name: 'Professional',
    paypalPlanId: process.env.PAYPAL_PLAN_PROFESSIONAL ?? '',
    monthlyPrice: 299,
    maxAnimals: 15000,
    maxUsers: 40,
    maxReportsPerMonth: -1,
    hasApiAccess: true,
    hasAAALACSupport: false,
  },
  'enterprise-saas': {
    name: 'Enterprise SaaS',
    paypalPlanId: process.env.PAYPAL_PLAN_ENTERPRISE_SAAS ?? '',
    monthlyPrice: 499,
    maxAnimals: -1,
    maxUsers: -1,
    maxReportsPerMonth: -1,
    hasApiAccess: true,
    hasAAALACSupport: true,
  },
};

/** 年付折扣 */
export const ANNUAL_DISCOUNT_PERCENT = 10;

/** PayPal 环境变量 */
export const PAYPAL_REQUIRED_ENV = ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'] as const;

/**
 * 获取 PayPal API 基础 URL
 */
export function getPayPalBaseUrl(): string {
  const env = process.env.PAYPAL_ENV ?? 'sandbox';
  return env === 'production' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

/**
 * 获取 PayPal Access Token（OAuth 2.0）
 */
export async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials not configured');
  }

  const baseUrl = getPayPalBaseUrl();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error(`PayPal auth failed: ${response.status}`);
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

/**
 * 获取套餐配置
 */
export function getPayPalPlan(planId: string): PayPalPlan | null {
  return PAYPAL_PLANS[planId] ?? null;
}
