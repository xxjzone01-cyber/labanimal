/**
 * 告警邮件发送
 *
 * 发送系统告警到管理员邮箱。
 * 使用 ALERT_EMAIL 环境变量配置接收邮箱。
 */

import { getResend, getFromEmail } from './email/resend.js';

let lastAlertTime = 0;
const ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 分钟内不重复发送

export function sendAlertEmail(alerts: string[]): void {
  const now = Date.now();
  if (now - lastAlertTime < ALERT_COOLDOWN_MS) return;

  const alertEmail = process.env.ALERT_EMAIL;
  if (!alertEmail) return;

  const resend = getResend();
  if (!resend) return;

  lastAlertTime = now;

  const alertList = alerts.map((a) => `<li style="padding: 4px 0; color: #dc2626;">${a}</li>`).join('');

  const html = `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #dc2626; margin-top: 0;">LabAnimal System Alert</h2>
      <p style="color: #374151;">The following issues were detected:</p>
      <ul style="list-style: none; padding: 0; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px;">
        ${alertList}
      </ul>
      <p style="color: #6b7280; font-size: 13px; margin-top: 16px;">
        Time: ${new Date().toISOString()}<br>
        Server: ${process.env.APP_URL || 'unknown'}
      </p>
    </div>
  `;

  void resend.emails.send({
    from: getFromEmail(),
    to: alertEmail,
    subject: `[LabAnimal Alert] ${alerts.length} issue(s) detected`,
    html,
  }).catch((err) => {
    console.error('[Alert] Failed to send alert email:', err);
  });
}
