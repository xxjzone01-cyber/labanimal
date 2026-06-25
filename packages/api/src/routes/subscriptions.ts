/**
 * 订阅管理路由
 *
 * POST /api/subscriptions/create   — 创建 PayPal 订阅
 * POST /api/subscriptions/activate — 激活订阅（PayPal 回调）
 * POST /api/subscriptions/cancel   — 取消订阅
 * GET  /api/subscriptions/status   — 查询当前订阅状态
 * POST /api/subscriptions/webhook  — PayPal Webhook 回调
 */

import { Hono } from 'hono';
import { authMiddleware, getUser } from '../middleware/auth.js';
import { prisma } from '../lib/db.js';
import { getPayPalPlan, getPayPalBaseUrl, getPayPalAccessToken } from '../billing/paypal-config.js';

const subscriptions = new Hono();

subscriptions.use('*', authMiddleware);

/**
 * POST /create — 创建 PayPal 订阅
 *
 * 返回 PayPal 订阅链接，用户在 PayPal 页面完成授权。
 */
subscriptions.post('/create', async (c) => {
  const user = getUser(c);
  const body = await c.req.json<{ planId: string; labId: string }>();

  if (!body.planId || !body.labId) {
    return c.json({ error: 'planId and labId are required' }, 400);
  }

  const plan = getPayPalPlan(body.planId);
  if (!plan) {
    return c.json({ error: `Unknown plan: ${body.planId}` }, 400);
  }

  // 免费套餐不需要 PayPal
  if (plan.monthlyPrice === 0) {
    // 直接激活免费套餐
    const subscription = await prisma.subscription.upsert({
      where: { labId: body.labId },
      update: {
        provider: 'free',
        planId: body.planId,
        status: 'active',
        paypalSubscriptionId: null,
        currentPeriodStart: new Date(),
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      },
      create: {
        labId: body.labId,
        provider: 'free',
        planId: body.planId,
        status: 'active',
      },
    });

    return c.json({ subscription, message: 'Free plan activated' });
  }

  // 验证用户属于该 lab
  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: body.labId } },
  });

  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  // 需要 PayPal Plan ID
  if (!plan.paypalPlanId) {
    return c.json({ error: 'PayPal Plan ID not configured for this tier' }, 500);
  }

  try {
    const accessToken = await getPayPalAccessToken();
    const baseUrl = getPayPalBaseUrl();

    // 创建 PayPal 订阅
    const response = await fetch(`${baseUrl}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        plan_id: plan.paypalPlanId,
        subscriber: {
          email_address: user.email,
        },
        application_context: {
          brand_name: 'LabAnimal',
          locale: 'en-US',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'SUBSCRIBE_NOW',
          return_url: `${process.env.APP_URL ?? 'http://localhost:3000'}/subscription/success`,
          cancel_url: `${process.env.APP_URL ?? 'http://localhost:3000'}/subscription/cancel`,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('PayPal subscription creation failed:', error);
      return c.json({ error: 'Failed to create PayPal subscription' }, 500);
    }

    const data = (await response.json()) as {
      id: string;
      status: string;
      links: Array<{ href: string; rel: string }>;
    };

    // 保存待激活的订阅
    await prisma.subscription.upsert({
      where: { labId: body.labId },
      update: {
        provider: 'paypal',
        planId: body.planId,
        status: 'pending',
        paypalSubscriptionId: data.id,
      },
      create: {
        labId: body.labId,
        provider: 'paypal',
        planId: body.planId,
        status: 'pending',
        paypalSubscriptionId: data.id,
      },
    });

    // 返回 PayPal 审批链接
    const approveLink = data.links.find((l) => l.rel === 'approve');
    return c.json({
      subscriptionId: data.id,
      approveUrl: approveLink?.href,
      status: data.status,
    });
  } catch (err) {
    console.error('PayPal subscription error:', err);
    return c.json({ error: 'Internal error creating subscription' }, 500);
  }
});

/**
 * POST /activate — 激活订阅（前端在 PayPal 审批后调用）
 */
subscriptions.post('/activate', async (c) => {
  const user = getUser(c);
  const body = await c.req.json<{ subscriptionId: string; labId: string }>();

  if (!body.subscriptionId || !body.labId) {
    return c.json({ error: 'subscriptionId and labId are required' }, 400);
  }

  // 验证用户属于该 lab
  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: body.labId } },
  });

  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  try {
    const accessToken = await getPayPalAccessToken();
    const baseUrl = getPayPalBaseUrl();

    // 查询 PayPal 订阅状态
    const response = await fetch(`${baseUrl}/v1/billing/subscriptions/${body.subscriptionId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return c.json({ error: 'Failed to verify PayPal subscription' }, 500);
    }

    const data = (await response.json()) as {
      status: string;
      billing_info: {
        next_billing_time: string;
        last_payment: { time: string };
      };
    };

    if (data.status !== 'ACTIVE') {
      return c.json(
        {
          error: `Subscription not active. Status: ${data.status}`,
          status: data.status,
        },
        400,
      );
    }

    // 更新数据库
    const subscription = await prisma.subscription.update({
      where: { labId: body.labId },
      data: {
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: data.billing_info.next_billing_time
          ? new Date(data.billing_info.next_billing_time)
          : null,
      },
    });

    return c.json({ subscription, message: 'Subscription activated' });
  } catch (err) {
    console.error('PayPal activation error:', err);
    return c.json({ error: 'Internal error activating subscription' }, 500);
  }
});

/**
 * POST /cancel — 取消订阅
 */
subscriptions.post('/cancel', async (c) => {
  const user = getUser(c);
  const body = await c.req.json<{ labId: string; reason?: string }>();

  if (!body.labId) {
    return c.json({ error: 'labId is required' }, 400);
  }

  // 验证用户属于该 lab
  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId: body.labId } },
  });

  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const subscription = await prisma.subscription.findUnique({
    where: { labId: body.labId },
  });

  if (!subscription) {
    return c.json({ error: 'No active subscription found' }, 404);
  }

  // 免费套餐直接取消
  if (subscription.provider === 'free') {
    await prisma.subscription.update({
      where: { labId: body.labId },
      data: { status: 'cancelled' },
    });
    return c.json({ message: 'Free plan cancelled' });
  }

  // PayPal 订阅取消
  if (subscription.provider === 'paypal' && subscription.paypalSubscriptionId) {
    try {
      const accessToken = await getPayPalAccessToken();
      const baseUrl = getPayPalBaseUrl();

      const response = await fetch(
        `${baseUrl}/v1/billing/subscriptions/${subscription.paypalSubscriptionId}/cancel`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reason: body.reason ?? 'User requested cancellation',
          }),
        },
      );

      if (!response.ok && response.status !== 204) {
        return c.json({ error: 'Failed to cancel PayPal subscription' }, 500);
      }
    } catch (err) {
      console.error('PayPal cancellation error:', err);
      return c.json({ error: 'Internal error cancelling subscription' }, 500);
    }
  }

  // 更新数据库
  await prisma.subscription.update({
    where: { labId: body.labId },
    data: {
      status: 'cancelled',
      cancelAtPeriodEnd: true,
    },
  });

  return c.json({ message: 'Subscription cancelled. Access until period end.' });
});

/**
 * GET /status — 查询当前订阅状态
 */
subscriptions.get('/status', async (c) => {
  const user = getUser(c);
  const labId = c.req.query('labId');

  if (!labId) {
    return c.json({ error: 'labId query parameter is required' }, 400);
  }

  const membership = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId } },
  });

  if (!membership) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const subscription = await prisma.subscription.findUnique({
    where: { labId },
  });

  if (!subscription) {
    return c.json({
      plan: 'academic-free',
      status: 'active',
      provider: 'free',
    });
  }

  return c.json(subscription);
});

/**
 * POST /webhook — PayPal Webhook 回调
 *
 * 处理订阅生命周期事件：
 * - BILLING.SUBSCRIPTION.ACTIVATED
 * - BILLING.SUBSCRIPTION.CANCELLED
 * - BILLING.SUBSCRIPTION.SUSPENDED
 * - BILLING.SUBSCRIPTION.PAYMENT.FAILED
 */
subscriptions.post('/webhook', async (c) => {
  const body = await c.req.json<{
    event_type: string;
    resource: {
      id: string;
      status: string;
      billing_info?: {
        next_billing_time?: string;
      };
    };
  }>();

  const { event_type, resource } = body;

  // 查找订阅
  const subscription = await prisma.subscription.findFirst({
    where: { paypalSubscriptionId: resource.id },
  });

  if (!subscription) {
    console.warn('Webhook for unknown subscription:', resource.id);
    return c.json({ status: 'ignored' });
  }

  switch (event_type) {
    case 'BILLING.SUBSCRIPTION.ACTIVATED':
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'active',
          currentPeriodEnd: resource.billing_info?.next_billing_time
            ? new Date(resource.billing_info.next_billing_time)
            : null,
        },
      });
      break;

    case 'BILLING.SUBSCRIPTION.CANCELLED':
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'cancelled' },
      });
      break;

    case 'BILLING.SUBSCRIPTION.SUSPENDED':
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'suspended' },
      });
      break;

    case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
      // 标记为过期，但不立即取消
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'expired' },
      });
      break;

    default:
      console.log('Unhandled webhook event:', event_type);
  }

  return c.json({ status: 'ok' });
});

export { subscriptions };
