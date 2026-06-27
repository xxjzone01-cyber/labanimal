/**
 * Stripe 订阅路由
 */

import { Hono } from 'hono';
import type { BillingWallDeps } from '../billing-wall.js';
import { STRIPE_PLANS } from '../stripe-config.js';

export function createStripeRoutes(deps: BillingWallDeps) {
  const { prisma, getUser } = deps;
  const stripe = new Hono();

  stripe.get('/config', (c) => {
    return c.json({
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
      plans: Object.entries(STRIPE_PLANS).map(([id, plan]) => ({
        id, name: plan.name, priceId: plan.priceId, monthlyPrice: plan.monthlyPrice,
      })),
    });
  });

  stripe.post('/create', async (c) => {
    const user = getUser(c);
    const body = await c.req.json<{ planId: string; labId: string; billing?: 'monthly' | 'annual' }>();

    if (!body.planId || !body.labId) return c.json({ error: 'planId and labId are required' }, 400);

    const plan = STRIPE_PLANS[body.planId];
    if (!plan) return c.json({ error: `Unknown plan: ${body.planId}` }, 400);

    if (plan.monthlyPrice === 0) {
      const subscription = await prisma.subscription.upsert({
        where: { labId: body.labId },
        update: { provider: 'free', planId: body.planId, status: 'active', stripeSubscriptionId: null, currentPeriodStart: new Date(), currentPeriodEnd: null, cancelAtPeriodEnd: false },
        create: { labId: body.labId, provider: 'free', planId: body.planId, status: 'active' },
      });
      return c.json({ subscription, message: 'Free plan activated' });
    }

    const membership = await prisma.userLab.findUnique({
      where: { userId_labId: { userId: user.userId, labId: body.labId } },
    });
    if (!membership) return c.json({ error: 'Access denied' }, 403);

    if (!plan.priceId) return c.json({ error: 'Stripe Price ID not configured for this plan' }, 500);

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) return c.json({ error: 'Stripe not configured' }, 500);

    try {
      const params = new URLSearchParams({
        mode: 'subscription',
        success_url: `${process.env.APP_URL ?? 'http://localhost:5173'}/subscriptions?success=true`,
        cancel_url: `${process.env.APP_URL ?? 'http://localhost:5173'}/subscriptions?cancelled=true`,
        'line_items[0][price]': plan.priceId,
        'line_items[0][quantity]': '1',
        client_reference_id: body.labId,
        customer_email: user.email!,
        'metadata[labId]': body.labId,
        'metadata[planId]': body.planId,
        'automatic_tax[enabled]': 'true',
        'subscription_data[trial_period_days]': '30',
        'subscription_data[metadata][labId]': body.labId,
        'subscription_data[metadata][planId]': body.planId,
      });

      if (body.billing === 'annual' && plan.annualPriceId) {
        params.set('line_items[0][price]', plan.annualPriceId);
      }

      const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Stripe checkout session creation failed:', error);
        return c.json({ error: 'Failed to create checkout session' }, 500);
      }

      const session = (await response.json()) as { id: string; url: string };

      await prisma.subscription.upsert({
        where: { labId: body.labId },
        update: { provider: 'stripe', planId: body.planId, status: 'pending', stripeSubscriptionId: session.id },
        create: { labId: body.labId, provider: 'stripe', planId: body.planId, status: 'pending', stripeSubscriptionId: session.id },
      });

      return c.json({ sessionId: session.id, url: session.url });
    } catch (err) {
      console.error('Stripe checkout error:', err);
      return c.json({ error: 'Internal error creating checkout session' }, 500);
    }
  });

  stripe.post('/webhook', async (c) => {
    const sig = c.req.header('stripe-signature');
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!sig || !webhookSecret || !secretKey) return c.json({ error: 'Stripe webhook not configured' }, 500);

    const body = await c.req.text();

    try {
      const timestamp = sig.split(',')[0]?.split('=')[1];
      const signatures = sig.split(',').filter((s) => s.startsWith('v1=')).map((s) => s.split('=')[1]);
      const payload = `${timestamp}.${body}`;

      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(webhookSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
      const expectedSig = Array.from(new Uint8Array(sigBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');

      if (!signatures.some((s) => s === expectedSig)) {
        return c.json({ error: 'Invalid signature' }, 400);
      }
    } catch (err) {
      console.error('Stripe webhook signature error:', err);
      return c.json({ error: 'Signature verification error' }, 400);
    }

    const event = JSON.parse(body) as { type: string; data: { object: Record<string, any> } };
    const { type, data: { object: session } } = event;

    switch (type) {
      case 'checkout.session.completed': {
        const labId = session.metadata?.labId || session.client_reference_id;
        const planId = session.metadata?.planId;
        const subscriptionId = session.subscription as string;
        if (labId && subscriptionId) {
          await prisma.subscription.upsert({
            where: { labId },
            update: { provider: 'stripe', planId: planId || 'starter', status: 'active', stripeSubscriptionId: subscriptionId, currentPeriodStart: new Date() },
            create: { labId, provider: 'stripe', planId: planId || 'starter', status: 'active', stripeSubscriptionId: subscriptionId },
          });
          deps.onSubscriptionActivated?.(labId, planId || 'starter');
        }
        break;
      }
      case 'customer.subscription.updated': {
        const sub = await prisma.subscription.findFirst({ where: { stripeSubscriptionId: session.id as string } });
        if (sub) {
          const newStatus = session.status === 'active' ? 'active' : session.status === 'past_due' ? 'expired' : session.status === 'canceled' ? 'cancelled' : sub.status;
          await prisma.subscription.update({ where: { id: sub.id }, data: { status: newStatus, currentPeriodEnd: session.current_period_end ? new Date(session.current_period_end * 1000) : null } });
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = await prisma.subscription.findFirst({ where: { stripeSubscriptionId: session.id as string } });
        if (sub) await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'cancelled' } });
        break;
      }
      case 'invoice.payment_failed': {
        const sub = await prisma.subscription.findFirst({ where: { stripeSubscriptionId: session.subscription as string } });
        if (sub) await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'expired' } });
        break;
      }
    }

    return c.json({ received: true });
  });

  return stripe;
}
