/**
 * 联系表单 API
 *
 * POST /api/contact — 接收联系表单，通过 Resend 发邮件到 contact@labanimal.tech
 * 速率限制：IP 级 5 次/小时
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { getResend, getFromEmail } from '../lib/email/resend.js';

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
  subject: z.enum(['general', 'technical', 'sales', 'enterprise', 'feedback', 'partnership', 'other']),
  message: z.string().min(10, 'Message must be at least 10 characters').max(5000),
});

// 简易内存速率限制（IP → 时间戳列表）
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT = 5;
const RATE_WINDOW = 60 * 60 * 1000; // 1 小时

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  const recent = timestamps.filter((t) => now - t < RATE_WINDOW);
  if (recent.length >= RATE_LIMIT) return false;
  recent.push(now);
  rateLimitMap.set(ip, recent);
  return true;
}

const subjectLabels: Record<string, string> = {
  general: '一般咨询',
  technical: '技术支持',
  sales: '销售咨询',
  enterprise: '企业私有化',
  feedback: '产品反馈',
  partnership: '合作机会',
  other: '其他',
};

export const contact = new Hono();

contact.post('/', async (c) => {
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';

  if (!checkRateLimit(ip)) {
    return c.json({ error: 'Rate limit exceeded. Please try again later.' }, 429);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const { name, email, subject, message } = parsed.data;
  const resend = getResend();

  if (!resend) {
    console.log('[Contact] Resend not configured, logging message:', { name, email, subject });
    return c.json({ success: true, message: 'Message received' });
  }

  try {
    await resend.emails.send({
      from: getFromEmail(),
      to: 'contact@labanimal.tech',
      replyTo: email,
      subject: `[LabAnimal 联系表单] ${subjectLabels[subject]} — ${name}`,
      html: `
        <h2>新的联系表单提交</h2>
        <table style="border-collapse:collapse;width:100%;max-width:600px">
          <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">姓名</td><td style="padding:8px;border:1px solid #e5e7eb">${name}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">邮箱</td><td style="padding:8px;border:1px solid #e5e7eb"><a href="mailto:${email}">${email}</a></td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">主题</td><td style="padding:8px;border:1px solid #e5e7eb">${subjectLabels[subject]}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">IP</td><td style="padding:8px;border:1px solid #e5e7eb">${ip}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">时间</td><td style="padding:8px;border:1px solid #e5e7eb">${new Date().toISOString()}</td></tr>
        </table>
        <h3 style="margin-top:16px">消息内容</h3>
        <p style="white-space:pre-wrap;background:#f9fafb;padding:12px;border-radius:8px;border:1px solid #e5e7eb">${message}</p>
      `,
    });

    return c.json({ success: true, message: 'Message sent successfully' });
  } catch (err) {
    console.error('[Contact] Failed to send email:', err);
    return c.json({ error: 'Failed to send message. Please try again later.' }, 500);
  }
});
