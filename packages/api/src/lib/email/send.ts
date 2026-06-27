/**
 * 高层邮件发送函数（fire-and-forget）
 *
 * 所有函数用 void 前缀调用，错误仅 console.error，不向上抛出。
 * getResend() 返回 null 时静默跳过。
 */

import { getResend, getFromEmail } from './resend.js';
import {
  welcomeEmail,
  subscriptionConfirmation,
  trialExpiryReminder,
  passwordResetEmail,
  trialUsageReport,
  trialDay12Reminder,
  quotaAlert,
  unsignedReportAlert,
  protocolExpiryReminder,
  monthlyInvoiceEmail,
  inviteEmail,
} from './templates.js';

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  try {
    await resend.emails.send({
      from: getFromEmail(),
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error(`[Email] Failed to send "${subject}" to ${to}:`, err);
  }
}

/** 发送欢迎邮件 */
export function sendWelcomeEmail(to: string, userName: string): void {
  const content = welcomeEmail(userName);
  void sendEmail(to, content.subject, content.html);
}

/** 发送订阅确认邮件 */
export function sendSubscriptionConfirmation(
  to: string,
  data: { userName: string; planName: string; amount: string; periodEnd: string },
): void {
  const content = subscriptionConfirmation(data);
  void sendEmail(to, content.subject, content.html);
}

/** 发送到期提醒邮件 */
export function sendTrialExpiryReminder(
  to: string,
  data: { userName: string; labName: string; daysRemaining: number },
): void {
  const content = trialExpiryReminder(data);
  void sendEmail(to, content.subject, content.html);
}

/** 发送密码重置邮件 */
export function sendPasswordReset(to: string, userName: string, resetLink: string): void {
  const content = passwordResetEmail(userName, resetLink);
  void sendEmail(to, content.subject, content.html);
}

/** 发送试用第7天使用报告 */
export function sendTrialUsageReport(
  to: string,
  data: { userName: string; labName: string; animalCount: number; protocolCount: number; reportCount: number },
): void {
  const content = trialUsageReport(data);
  void sendEmail(to, content.subject, content.html);
}

/** 发送试用第12天到期提醒 */
export function sendTrialDay12Reminder(
  to: string,
  data: { userName: string; labName: string },
): void {
  const content = trialDay12Reminder(data);
  void sendEmail(to, content.subject, content.html);
}

/** 发送动物配额告警 */
export function sendQuotaAlert(
  to: string,
  data: { userName: string; labName: string; currentCount: number; limit: number },
): void {
  const content = quotaAlert(data);
  void sendEmail(to, content.subject, content.html);
}

/** 发送报告未签名告警 */
export function sendUnsignedReportAlert(
  to: string,
  data: { userName: string; labName: string },
): void {
  const content = unsignedReportAlert(data);
  void sendEmail(to, content.subject, content.html);
}

/** 发送协议到期提醒 */
export function sendProtocolExpiryReminder(
  to: string,
  data: { userName: string; labName: string; protocolTitle: string; daysRemaining: number },
): void {
  const content = protocolExpiryReminder(data);
  void sendEmail(to, content.subject, content.html);
}

/** 发送月度账单 */
export function sendMonthlyInvoice(
  to: string,
  data: {
    userName: string;
    labName: string;
    month: string;
    totalAmount: string;
    animalCost: string;
    cageCost: string;
    animalCount: number;
    reportCount: number;
  },
): void {
  const content = monthlyInvoiceEmail(data);
  void sendEmail(to, content.subject, content.html);
}

/** 发送团队邀请邮件 */
export function sendInviteEmail(
  to: string,
  data: { inviterName: string; labName: string; role: string; inviteLink: string },
): void {
  const content = inviteEmail(data);
  void sendEmail(to, content.subject, content.html);
}
