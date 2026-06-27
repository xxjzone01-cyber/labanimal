/**
 * 订阅管理路由（PayPal）
 */

import { Hono } from 'hono';
import type { BillingWallDeps } from '../billing-wall.js';
import { getPayPalPlan, getPayPalBaseUrl, getPayPalAccessToken } from '../paypal-config.js';

export function createSubscriptionsRoutes(deps: BillingWallDeps) {
  const { prisma, getUser } = deps;
  const subscriptions = new Hono();

  subscriptions.post('/create', async (c) => {
    const user = getUser(c);
    const body = await c.req.json<{ planId: string; labId: string }>();

    if (!body.planId || !body.labId) return c.json({ error: 'planId and labId are required' }, 400);

    const plan = getPayPalPlan(body.planId);
    if (!plan) return c.json({ error: `Unknown plan: ${body.planId}` }, 400);

    if (plan.monthlyPrice === 0) {
      const subscription = await prisma.subscription.upsert({
        where: { labId: body.labId },
        update: { provider: 'free', planId: body.planId, status: 'active', paypalSubscriptionId: null, currentPeriodStart: new Date(), currentPeriodEnd: null, cancelAtPeriodEnd: false },
        create: { labId: body.labId, provider: 'free', planId: body.planId, status: 'active' },
      });
      return c.json({ subscription, message: 'Free plan activated' });
    }

    const membership = await prisma.userLab.findUnique({
      where: { userId_labId: { userId: user.userId, labId: body.labId } },
    });
    if (!membership) return c.json({ error: 'Access denied' }, 403);

    if (!plan.paypalPlanId) return c.json({ error: 'PayPal Plan ID not configured for this tier' }, 500);

    try {
      const accessToken = await getPayPalAccessToken();
      const baseUrl = getPayPalBaseUrl();

      const response = await fetch(`${baseUrl}/v1/billing/subscriptions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({
          plan_id: plan.paypalPlanId,
          subscriber: { email_address: user.email },
          application_context: {
            brand_name: 'LabAnimal', locale: 'en-US', shipping_preference: 'NO_SHIPPING', user_action: 'SUBSCRIBE_NOW',
            return_url: `${process.env.APP_URL ?? 'http://localhost:3000'}/subscription/success`,
            cancel_url: `${process.env.APP_URL ?? 'http://localhost:3000'}/subscription/cancel`,
          },
        }),
      });

      if (!response.ok) {
        console.error('PayPal subscription creation failed:', await response.text());
        return c.json({ error: 'Failed to create PayPal subscription' }, 500);
      }

      const data = (await response.json()) as { id: string; status: string; links: Array<{ href: string; rel: string }> };

      await prisma.subscription.upsert({
        where: { labId: body.labId },
        update: { provider: 'paypal', planId: body.planId, status: 'pending', paypalSubscriptionId: data.id },
        create: { labId: body.labId, provider: 'paypal', planId: body.planId, status: 'pending', paypalSubscriptionId: data.id },
      });

      const approveLink = data.links.find((l) => l.rel === 'approve');
      return c.json({ subscriptionId: data.id, approveUrl: approveLink?.href, status: data.status });
    } catch (err) {
      console.error('PayPal subscription error:', err);
      return c.json({ error: 'Internal error creating subscription' }, 500);
    }
  });

  subscriptions.post('/activate', async (c) => {
    const user = getUser(c);
    const body = await c.req.json<{ subscriptionId: string; labId: string }>();

    if (!body.subscriptionId || !body.labId) return c.json({ error: 'subscriptionId and labId are required' }, 400);

    const membership = await prisma.userLab.findUnique({
      where: { userId_labId: { userId: user.userId, labId: body.labId } },
    });
    if (!membership) return c.json({ error: 'Access denied' }, 403);

    try {
      const accessToken = await getPayPalAccessToken();
      const baseUrl = getPayPalBaseUrl();

      const response = await fetch(`${baseUrl}/v1/billing/subscriptions/${body.subscriptionId}`, {
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      });

      if (!response.ok) return c.json({ error: 'Failed to verify PayPal subscription' }, 500);

      const data = (await response.json()) as { status: string; billing_info: { next_billing_time: string } };

      if (data.status !== 'ACTIVE') return c.json({ error: `Subscription not active. Status: ${data.status}`, status: data.status }, 400);

      const subscription = await prisma.subscription.update({
        where: { labId: body.labId },
        data: { status: 'active', currentPeriodStart: new Date(), currentPeriodEnd: data.billing_info.next_billing_time ? new Date(data.billing_info.next_billing_time) : null },
      });

      deps.onSubscriptionActivated?.(body.labId, subscription.planId);

      return c.json({ subscription, message: 'Subscription activated' });
    } catch (err) {
      console.error('PayPal activation error:', err);
      return c.json({ error: 'Internal error activating subscription' }, 500);
    }
  });

  subscriptions.post('/cancel', async (c) => {
    const user = getUser(c);
    const body = await c.req.json<{ labId: string; reason?: string }>();

    if (!body.labId) return c.json({ error: 'labId is required' }, 400);

    const membership = await prisma.userLab.findUnique({
      where: { userId_labId: { userId: user.userId, labId: body.labId } },
    });
    if (!membership) return c.json({ error: 'Access denied' }, 403);

    const subscription = await prisma.subscription.findUnique({ where: { labId: body.labId } });
    if (!subscription) return c.json({ error: 'No active subscription found' }, 404);

    if (subscription.provider === 'free') {
      await prisma.subscription.update({ where: { labId: body.labId }, data: { status: 'cancelled' } });
      return c.json({ message: 'Free plan cancelled' });
    }

    if (subscription.provider === 'paypal' && subscription.paypalSubscriptionId) {
      try {
        const accessToken = await getPayPalAccessToken();
        const baseUrl = getPayPalBaseUrl();

        const response = await fetch(`${baseUrl}/v1/billing/subscriptions/${subscription.paypalSubscriptionId}/cancel`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: body.reason ?? 'User requested cancellation' }),
        });

        if (!response.ok && response.status !== 204) return c.json({ error: 'Failed to cancel PayPal subscription' }, 500);
      } catch (err) {
        console.error('PayPal cancellation error:', err);
        return c.json({ error: 'Internal error cancelling subscription' }, 500);
      }
    }

    await prisma.subscription.update({ where: { labId: body.labId }, data: { status: 'cancelled', cancelAtPeriodEnd: true } });
    return c.json({ message: 'Subscription cancelled. Access until period end.' });
  });

  subscriptions.get('/status', async (c) => {
    const user = getUser(c);
    const labId = c.req.query('labId');

    if (!labId) return c.json({ error: 'labId query parameter is required' }, 400);

    const membership = await prisma.userLab.findUnique({
      where: { userId_labId: { userId: user.userId, labId } },
    });
    if (!membership) return c.json({ error: 'Access denied' }, 403);

    const subscription = await prisma.subscription.findUnique({ where: { labId } });

    if (!subscription) return c.json({ plan: 'academic-free', status: 'active', provider: 'free' });

    return c.json(subscription);
  });

  // PayPal Webhook
  subscriptions.post('/webhook', async (c) => {
    const rawBody = await c.req.text();

    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) return c.json({ error: 'PayPal webhook not configured' }, 500);

    const headers: Record<string, string | undefined> = {
      'paypal-transmission-id': c.req.header('paypal-transmission-id'),
      'paypal-transmission-time': c.req.header('paypal-transmission-time'),
      'paypal-cert-url': c.req.header('paypal-cert-url'),
      'paypal-auth-algo': c.req.header('paypal-auth-algo'),
      'paypal-transmission-sig': c.req.header('paypal-transmission-sig'),
    };

    const { 'paypal-transmission-id': transmissionId, 'paypal-transmission-time': transmissionTime, 'paypal-cert-url': certUrl, 'paypal-auth-algo': authAlgo, 'paypal-transmission-sig': transmissionSig } = headers;

    if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
      return c.json({ error: 'Missing PayPal webhook headers' }, 400);
    }

    try {
      const accessToken = await getPayPalAccessToken();
      const baseUrl = getPayPalBaseUrl();

      const verifyResponse = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth_algo: authAlgo, cert_url: certUrl, transmission_id: transmissionId,
          transmission_sig: transmissionSig, transmission_time: transmissionTime,
          webhook_id: webhookId, webhook_event: JSON.parse(rawBody),
        }),
      });

      if (!verifyResponse.ok) return c.json({ error: 'Webhook verification failed' }, 400);

      const verifyData = (await verifyResponse.json()) as { verification_status: string };
      if (verifyData.verification_status !== 'SUCCESS') return c.json({ error: 'Invalid webhook signature' }, 400);
    } catch (err) {
      console.error('PayPal webhook verification error:', err);
      return c.json({ error: 'Webhook verification error' }, 400);
    }

    const body = JSON.parse(rawBody) as {
      event_type: string;
      resource: { id: string; status: string; billing_info?: { next_billing_time?: string } };
    };

    const { event_type, resource } = body;

    const subscription = await prisma.subscription.findFirst({ where: { paypalSubscriptionId: resource.id } });
    if (!subscription) return c.json({ status: 'ignored' });

    switch (event_type) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        await prisma.subscription.update({ where: { id: subscription.id }, data: { status: 'active', currentPeriodEnd: resource.billing_info?.next_billing_time ? new Date(resource.billing_info.next_billing_time) : null } });
        deps.onSubscriptionActivated?.(subscription.labId, subscription.planId);
        break;
      case 'BILLING.SUBSCRIPTION.CANCELLED':
        await prisma.subscription.update({ where: { id: subscription.id }, data: { status: 'cancelled' } });
        break;
      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        await prisma.subscription.update({ where: { id: subscription.id }, data: { status: 'suspended' } });
        break;
      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
        await prisma.subscription.update({ where: { id: subscription.id }, data: { status: 'expired' } });
        break;
    }

    return c.json({ status: 'ok' });
  });

  return subscriptions;
}
