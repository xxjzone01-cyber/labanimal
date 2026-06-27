/**
 * 邮件调度器
 *
 * 每小时检查一次，处理：
 * 1. 订阅到期提醒（7/3/1 天）
 * 2. 试用期进度（第7天使用报告、第12天到期提醒）
 * 3. 协议到期提醒（30天前）
 * 4. 月度账单（每月1号）
 */

import { prisma } from './db.js';
import {
  sendTrialExpiryReminder,
  sendTrialUsageReport,
  sendTrialDay12Reminder,
  sendProtocolExpiryReminder,
  sendMonthlyInvoice,
} from './email/send.js';

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 小时

// 已发送提醒记录：key = 标识，value = 发送时间戳
const sentReminders = new Map<string, number>();

let timer: ReturnType<typeof setInterval> | null = null;

function wasRecentlySent(key: string, cooldownMs: number = 24 * 60 * 60 * 1000): boolean {
  const lastSent = sentReminders.get(key);
  return lastSent !== undefined && Date.now() - lastSent < cooldownMs;
}

function markSent(key: string): void {
  sentReminders.set(key, Date.now());
}

function cleanupOldEntries(): void {
  const now = Date.now();
  for (const [key, timestamp] of sentReminders) {
    if (now - timestamp > 7 * 24 * 60 * 60 * 1000) {
      sentReminders.delete(key);
    }
  }
}

/** 1. 订阅到期提醒（7/3/1 天） */
async function checkExpiringSubscriptions(): Promise<number> {
  const now = new Date();
  let notified = 0;
  const REMINDER_DAYS = [7, 3, 1];

  for (const days of REMINDER_DAYS) {
    const targetDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const windowStart = new Date(targetDate.getTime() - 12 * 60 * 60 * 1000);
    const windowEnd = new Date(targetDate.getTime() + 12 * 60 * 60 * 1000);

    const subscriptions = await prisma.subscription.findMany({
      where: { status: 'active', currentPeriodEnd: { gte: windowStart, lte: windowEnd } },
      include: {
        lab: {
          select: {
            name: true,
            users: { where: { role: 'admin' }, include: { user: { select: { email: true, name: true } } } },
          },
        },
      },
    });

    for (const sub of subscriptions) {
      const key = `expiry:${sub.labId}:${days}`;
      if (wasRecentlySent(key)) continue;

      const labName = (sub as any).lab?.name || 'Your Lab';
      const admins = (sub as any).lab?.users || [];
      for (const m of admins) {
        if (!m.user?.email) continue;
        sendTrialExpiryReminder(m.user.email, { userName: m.user.name || 'User', labName, daysRemaining: days });
        notified++;
      }
      markSent(key);
    }
  }
  return notified;
}

/** 2. 试用期进度（第7天、第12天） */
async function checkTrialProgress(): Promise<number> {
  const now = new Date();
  let notified = 0;

  // 查找所有 lab，检查 createdAt
  const labs = await prisma.lab.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      createdAt: true,
      users: { where: { role: 'admin' }, include: { user: { select: { email: true, name: true } } } },
    },
  });

  for (const lab of labs) {
    const daysSinceCreation = Math.floor((now.getTime() - lab.createdAt.getTime()) / (24 * 60 * 60 * 1000));

    // 检查是否已有付费订阅（付费用户跳过试用提醒）
    const sub = await prisma.subscription.findFirst({
      where: { labId: lab.id, status: 'active', planId: { not: 'academic-free' } },
    });
    if (sub) continue;

    // 第7天使用报告
    if (daysSinceCreation >= 7 && daysSinceCreation <= 8) {
      const key = `trial7:${lab.id}`;
      if (!wasRecentlySent(key)) {
        const [animalCount, protocolCount] = await Promise.all([
          prisma.animal.count({ where: { labId: lab.id, status: { notIn: ['deceased', 'retired'] } } }),
          prisma.protocol.count({ where: { labId: lab.id, status: 'approved' } }),
        ]);

        const admins = lab.users || [];
        for (const m of admins) {
          if (!m.user?.email) continue;
          sendTrialUsageReport(m.user.email, {
            userName: m.user.name || 'User',
            labName: lab.name,
            animalCount,
            protocolCount,
            reportCount: 0, // 简化：不查 AuditLog
          });
          notified++;
        }
        markSent(key);
      }
    }

    // 第12天到期提醒
    if (daysSinceCreation >= 12 && daysSinceCreation <= 13) {
      const key = `trial12:${lab.id}`;
      if (!wasRecentlySent(key)) {
        const admins = lab.users || [];
        for (const m of admins) {
          if (!m.user?.email) continue;
          sendTrialDay12Reminder(m.user.email, { userName: m.user.name || 'User', labName: lab.name });
          notified++;
        }
        markSent(key);
      }
    }
  }
  return notified;
}

/** 3. 协议到期提醒（30天前） */
async function checkProtocolExpiry(): Promise<number> {
  const now = new Date();
  let notified = 0;
  const REMINDER_DAYS = [30, 14, 7];

  for (const days of REMINDER_DAYS) {
    const targetDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const windowStart = new Date(targetDate.getTime() - 12 * 60 * 60 * 1000);
    const windowEnd = new Date(targetDate.getTime() + 12 * 60 * 60 * 1000);

    const protocols = await prisma.protocol.findMany({
      where: {
        status: 'approved',
        endDate: { gte: windowStart, lte: windowEnd },
        deletedAt: null,
      },
      include: {
        lab: {
          select: {
            name: true,
            users: { where: { role: 'admin' }, include: { user: { select: { email: true, name: true } } } },
          },
        },
      },
    });

    for (const protocol of protocols) {
      const key = `protocol:${protocol.id}:${days}`;
      if (wasRecentlySent(key)) continue;

      const labName = (protocol as any).lab?.name || 'Your Lab';
      const admins = (protocol as any).lab?.users || [];
      for (const m of admins) {
        if (!m.user?.email) continue;
        sendProtocolExpiryReminder(m.user.email, {
          userName: m.user.name || 'User',
          labName,
          protocolTitle: protocol.title,
          daysRemaining: days,
        });
        notified++;
      }
      markSent(key);
    }
  }
  return notified;
}

/** 4. 月度账单（每月1号检查） */
async function checkMonthlyInvoice(): Promise<number> {
  const now = new Date();
  // 仅在每月1-2号执行（24h窗口）
  if (now.getDate() > 2) return 0;

  const key = `invoice:${now.getFullYear()}-${now.getMonth()}`;
  if (wasRecentlySent(key, 48 * 60 * 60 * 1000)) return 0;

  let notified = 0;
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const monthLabel = lastMonth.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

  const labs = await prisma.lab.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      users: { where: { role: 'admin' }, include: { user: { select: { email: true, name: true } } } },
    },
  });

  const monthKey = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;

  for (const lab of labs) {
    const [animalCount, reportCount] = await Promise.all([
      prisma.animal.count({ where: { labId: lab.id, status: { notIn: ['deceased', 'retired'] } } }),
      prisma.auditLog.count({ where: { labId: lab.id, action: 'REPORT_SIGN', createdAt: { gte: lastMonth, lte: monthEnd } } }),
    ]);

    // 简化费用计算（基于当前动物数）
    const animalCostNum = animalCount * 0.5;
    const cageCostNum = animalCount * 0.1;
    const totalNum = animalCostNum + cageCostNum;
    const animalCost = `$${animalCostNum.toFixed(2)}`;
    const cageCost = `$${cageCostNum.toFixed(2)}`;
    const total = `$${totalNum.toFixed(2)}`;

    // 保存发票到数据库（upsert 防重复）
    await prisma.invoice.upsert({
      where: { labId_month: { labId: lab.id, month: monthKey } },
      create: {
        labId: lab.id,
        month: monthKey,
        animalCount,
        reportCount,
        animalCost: animalCostNum,
        cageCost: cageCostNum,
        totalAmount: totalNum,
        status: 'sent',
        sentAt: new Date(),
      },
      update: {
        animalCount,
        reportCount,
        animalCost: animalCostNum,
        cageCost: cageCostNum,
        totalAmount: totalNum,
        status: 'sent',
        sentAt: new Date(),
      },
    });

    const admins = lab.users || [];
    for (const m of admins) {
      if (!m.user?.email) continue;
      sendMonthlyInvoice(m.user.email, {
        userName: m.user.name || 'User',
        labName: lab.name,
        month: monthLabel,
        totalAmount: total,
        animalCost,
        cageCost,
        animalCount,
        reportCount,
      });
      notified++;
    }
  }

  markSent(key);
  return notified;
}

/** 执行所有检查 */
export async function runAllChecks(): Promise<{ total: number; breakdown: Record<string, number> }> {
  const breakdown: Record<string, number> = {};

  try { breakdown.expiry = await checkExpiringSubscriptions(); } catch (e) { console.error('[Scheduler] Expiry check failed:', e); breakdown.expiry = 0; }
  try { breakdown.trial = await checkTrialProgress(); } catch (e) { console.error('[Scheduler] Trial check failed:', e); breakdown.trial = 0; }
  try { breakdown.protocol = await checkProtocolExpiry(); } catch (e) { console.error('[Scheduler] Protocol check failed:', e); breakdown.protocol = 0; }
  try { breakdown.invoice = await checkMonthlyInvoice(); } catch (e) { console.error('[Scheduler] Invoice check failed:', e); breakdown.invoice = 0; }

  cleanupOldEntries();

  const total = Object.values(breakdown).reduce((s, v) => s + v, 0);
  return { total, breakdown };
}

/** 启动定时器（测试环境跳过） */
export function startScheduler(): void {
  if (process.env.VITEST || process.env.JEST_WORKER_ID) return;
  if (timer) return;

  timer = setInterval(() => {
    runAllChecks().catch((err) => {
      console.error('[Scheduler] Check failed:', err);
    });
  }, CHECK_INTERVAL_MS);

  // 首次启动延迟 30 秒执行
  setTimeout(() => {
    runAllChecks().catch((err) => {
      console.error('[Scheduler] Initial check failed:', err);
    });
  }, 30_000);

  console.log('[Scheduler] Email scheduler started (every 1h)');
}

/** 停止定时器（测试用） */
export function stopScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
