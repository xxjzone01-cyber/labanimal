/**
 * 邮件 HTML 模板（纯函数）
 *
 * 品牌色 #2563eb，与现有验证码邮件风格一致。
 */

interface EmailContent {
  subject: string;
  html: string;
}

const FOOTER = `
  <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px;">
    <p>LabAnimal — Laboratory Animal Management Platform</p>
    <p>If you didn't expect this email, please ignore it.</p>
  </div>
`;

function wrapHtml(title: string, body: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1f2937;">
      <div style="margin-bottom: 24px;">
        <h1 style="color: #2563eb; font-size: 20px; margin: 0;">LabAnimal</h1>
        <p style="color: #6b7280; font-size: 13px; margin: 4px 0 0;">${title}</p>
      </div>
      ${body}
      ${FOOTER}
    </div>
  `;
}

/** 欢迎邮件 */
export function welcomeEmail(userName: string): EmailContent {
  return {
    subject: 'Welcome to LabAnimal!',
    html: wrapHtml('Welcome', `
      <p>Hi ${userName},</p>
      <p>Welcome to LabAnimal! Your account has been created successfully.</p>
      <p>Here's how to get started:</p>
      <ol style="line-height: 1.8;">
        <li>Create or join a lab</li>
        <li>Add your first animals</li>
        <li>Set up rooms, racks, and cages</li>
        <li>Invite team members</li>
      </ol>
      <div style="margin: 24px 0;">
        <a href="${process.env.APP_URL || 'https://labanimal.tech'}"
           style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
          Go to Dashboard
        </a>
      </div>
      <p style="color: #6b7280; font-size: 14px;">If you have any questions, just reply to this email.</p>
    `),
  };
}

/** 订阅确认邮件 */
export function subscriptionConfirmation(data: {
  userName: string;
  planName: string;
  amount: string;
  periodEnd: string;
}): EmailContent {
  return {
    subject: `Subscription Confirmed — ${data.planName}`,
    html: wrapHtml('Subscription Confirmed', `
      <p>Hi ${data.userName},</p>
      <p>Your <strong>${data.planName}</strong> subscription has been activated.</p>
      <div style="background: #f0f9ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <table style="width: 100%; font-size: 14px;">
          <tr><td style="color: #6b7280;">Plan</td><td style="text-align: right; font-weight: 600;">${data.planName}</td></tr>
          <tr><td style="color: #6b7280;">Amount</td><td style="text-align: right;">${data.amount}</td></tr>
          <tr><td style="color: #6b7280;">Next billing</td><td style="text-align: right;">${data.periodEnd}</td></tr>
        </table>
      </div>
      <p>You now have access to all ${data.planName} features. Thank you for choosing LabAnimal!</p>
    `),
  };
}

/** 试用到期提醒邮件 */
export function trialExpiryReminder(data: {
  userName: string;
  labName: string;
  daysRemaining: number;
}): EmailContent {
  const urgency =
    data.daysRemaining <= 1 ? 'tomorrow' :
    data.daysRemaining <= 3 ? `in ${data.daysRemaining} days` :
    `in ${data.daysRemaining} days`;

  return {
    subject: `Your LabAnimal trial expires ${urgency}`,
    html: wrapHtml('Trial Expiring', `
      <p>Hi ${data.userName},</p>
      <p>Your LabAnimal trial for <strong>${data.labName}</strong> expires <strong>${urgency}</strong>.</p>
      <p>To continue using all features without interruption, please upgrade to a paid plan.</p>
      <div style="margin: 24px 0;">
        <a href="${process.env.APP_URL || 'https://labanimal.tech'}/subscriptions"
           style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
          Upgrade Now
        </a>
      </div>
      <p style="color: #6b7280; font-size: 14px;">If you don't upgrade, your account will be moved to the free tier with limited features.</p>
    `),
  };
}

/** 试用第7天功能使用报告 */
export function trialUsageReport(data: {
  userName: string;
  labName: string;
  animalCount: number;
  protocolCount: number;
  reportCount: number;
}): EmailContent {
  const appUrl = process.env.APP_URL || 'https://labanimal.cloud';
  return {
    subject: `Your first week with LabAnimal — ${data.labName}`,
    html: wrapHtml('Week 1 Report', `
      <p>Hi ${data.userName},</p>
      <p>It's been 7 days since you started using LabAnimal for <strong>${data.labName}</strong>. Here's your usage summary:</p>
      <div style="background: #f0f9ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <table style="width: 100%; font-size: 14px;">
          <tr><td style="color: #6b7280;">Animals tracked</td><td style="text-align: right; font-weight: 600;">${data.animalCount}</td></tr>
          <tr><td style="color: #6b7280;">Active protocols</td><td style="text-align: right; font-weight: 600;">${data.protocolCount}</td></tr>
          <tr><td style="color: #6b7280;">Reports generated</td><td style="text-align: right; font-weight: 600;">${data.reportCount}</td></tr>
        </table>
      </div>
      <p>Unlock unlimited reports, API access, and priority support with a paid plan.</p>
      <div style="margin: 24px 0;">
        <a href="${appUrl}/subscriptions"
           style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
          View Upgrade Options
        </a>
      </div>
    `),
  };
}

/** 试用第12天到期提醒 */
export function trialDay12Reminder(data: {
  userName: string;
  labName: string;
}): EmailContent {
  const appUrl = process.env.APP_URL || 'https://labanimal.cloud';
  return {
    subject: `Your LabAnimal trial ends in 2 days — ${data.labName}`,
    html: wrapHtml('Trial Ending Soon', `
      <p>Hi ${data.userName},</p>
      <p>Your 14-day trial for <strong>${data.labName}</strong> ends in <strong>2 days</strong>.</p>
      <p>To keep your data and continue with full compliance features, upgrade now:</p>
      <ul style="line-height: 1.8;">
        <li>Unlimited compliance reports with RSA signatures</li>
        <li>Priority email support</li>
        <li>Automated backups</li>
      </ul>
      <div style="margin: 24px 0;">
        <a href="${appUrl}/subscriptions"
           style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
          Upgrade Now
        </a>
      </div>
      <p style="color: #6b7280; font-size: 14px;">After the trial ends, your account will move to the free tier (500 animals, 3 reports/month).</p>
    `),
  };
}

/** 动物配额 80% 告警 */
export function quotaAlert(data: {
  userName: string;
  labName: string;
  currentCount: number;
  limit: number;
}): EmailContent {
  const appUrl = process.env.APP_URL || 'https://labanimal.cloud';
  const percent = Math.round((data.currentCount / data.limit) * 100);
  return {
    subject: `${data.labName} — ${percent}% of animal quota used`,
    html: wrapHtml('Quota Alert', `
      <p>Hi ${data.userName},</p>
      <p>Your lab <strong>${data.labName}</strong> has reached <strong>${percent}%</strong> of its animal quota.</p>
      <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <table style="width: 100%; font-size: 14px;">
          <tr><td style="color: #6b7280;">Current animals</td><td style="text-align: right; font-weight: 600;">${data.currentCount}</td></tr>
          <tr><td style="color: #6b7280;">Plan limit</td><td style="text-align: right; font-weight: 600;">${data.limit}</td></tr>
        </table>
      </div>
      <p>All animal data continues to be recorded. However, <strong>compliance report signing</strong> will be paused if you exceed the limit.</p>
      <div style="margin: 24px 0;">
        <a href="${appUrl}/subscriptions"
           style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
          Upgrade Plan
        </a>
      </div>
    `),
  };
}

/** 报告未签名导出告警 */
export function unsignedReportAlert(data: {
  userName: string;
  labName: string;
}): EmailContent {
  const appUrl = process.env.APP_URL || 'https://labanimal.cloud';
  return {
    subject: `${data.labName} — Report exported without compliance signature`,
    html: wrapHtml('Unsigned Report', `
      <p>Hi ${data.userName},</p>
      <p>A report was exported from <strong>${data.labName}</strong> <strong>without a compliance signature</strong>.</p>
      <p>Unsigned reports do not meet AAALAC electronic record audit requirements and may not be accepted during review.</p>
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0; color: #991b1b; font-size: 14px;">
          This usually happens when your plan limit is exceeded or your license verification has expired.
        </p>
      </div>
      <div style="margin: 24px 0;">
        <a href="${appUrl}/subscriptions"
           style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
          Restore Compliance Signing
        </a>
      </div>
    `),
  };
}

/** 协议到期提醒 */
export function protocolExpiryReminder(data: {
  userName: string;
  labName: string;
  protocolTitle: string;
  daysRemaining: number;
}): EmailContent {
  const appUrl = process.env.APP_URL || 'https://labanimal.cloud';
  return {
    subject: `Protocol expiring in ${data.daysRemaining} days — ${data.protocolTitle}`,
    html: wrapHtml('Protocol Expiring', `
      <p>Hi ${data.userName},</p>
      <p>The following protocol in <strong>${data.labName}</strong> is expiring soon:</p>
      <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0; font-weight: 600;">${data.protocolTitle}</p>
        <p style="margin: 4px 0 0; color: #92400e; font-size: 14px;">Expires in ${data.daysRemaining} days</p>
      </div>
      <p>Please submit a renewal or new protocol before expiration to avoid disruption.</p>
      <div style="margin: 24px 0;">
        <a href="${appUrl}/protocols"
           style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
          View Protocols
        </a>
      </div>
    `),
  };
}

/** 月度账单邮件 */
export function monthlyInvoiceEmail(data: {
  userName: string;
  labName: string;
  month: string;
  totalAmount: string;
  animalCost: string;
  cageCost: string;
  animalCount: number;
  reportCount: number;
}): EmailContent {
  const appUrl = process.env.APP_URL || 'https://labanimal.cloud';
  return {
    subject: `LabAnimal Invoice — ${data.month} — ${data.labName}`,
    html: wrapHtml(`Invoice ${data.month}`, `
      <p>Hi ${data.userName},</p>
      <p>Here's your usage summary for <strong>${data.labName}</strong> in <strong>${data.month}</strong>:</p>
      <div style="background: #f0f9ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <table style="width: 100%; font-size: 14px;">
          <tr><td style="color: #6b7280;">Animal care</td><td style="text-align: right;">${data.animalCost}</td></tr>
          <tr><td style="color: #6b7280;">Cage/facility</td><td style="text-align: right;">${data.cageCost}</td></tr>
          <tr style="border-top: 1px solid #bfdbfe;"><td style="font-weight: 600; padding-top: 8px;">Total</td><td style="text-align: right; font-weight: 600; padding-top: 8px;">${data.totalAmount}</td></tr>
        </table>
      </div>
      <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <table style="width: 100%; font-size: 13px; color: #6b7280;">
          <tr><td>Animals tracked</td><td style="text-align: right;">${data.animalCount}</td></tr>
          <tr><td>Reports generated</td><td style="text-align: right;">${data.reportCount}</td></tr>
        </table>
      </div>
      <div style="margin: 24px 0;">
        <a href="${appUrl}/billing"
           style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
          View Billing Details
        </a>
      </div>
    `),
  };
}

/** 团队邀请邮件 */
export function inviteEmail(data: {
  inviterName: string;
  labName: string;
  role: string;
  inviteLink: string;
}): EmailContent {
  return {
    subject: `You're invited to join ${data.labName} on LabAnimal`,
    html: wrapHtml('Team Invitation', `
      <p>Hi,</p>
      <p><strong>${data.inviterName}</strong> has invited you to join <strong>${data.labName}</strong> on LabAnimal as <strong>${data.role}</strong>.</p>
      <p>LabAnimal is a laboratory animal management platform with built-in AAALAC compliance features.</p>
      <div style="margin: 24px 0;">
        <a href="${data.inviteLink}"
           style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
          Accept Invitation
        </a>
      </div>
      <p style="color: #6b7280; font-size: 14px;">This link expires in 7 days. If you don't have a LabAnimal account, one will be created for you.</p>
    `),
  };
}

/** 密码重置邮件 */
export function passwordResetEmail(userName: string, resetLink: string): EmailContent {
  return {
    subject: 'Reset Your LabAnimal Password',
    html: wrapHtml('Password Reset', `
      <p>Hi ${userName},</p>
      <p>We received a request to reset your password. Click the button below to set a new password:</p>
      <div style="margin: 24px 0;">
        <a href="${resetLink}"
           style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
          Reset Password
        </a>
      </div>
      <p style="color: #6b7280; font-size: 14px;">This link expires in 1 hour. If you didn't request a password reset, please ignore this email.</p>
    `),
  };
}
