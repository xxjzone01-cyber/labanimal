/**
 * 邮件模块测试
 *
 * 测试模板纯函数 + send 函数的降级行为 + 密码重置路由。
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  welcomeEmail,
  subscriptionConfirmation,
  trialExpiryReminder,
  passwordResetEmail,
} from '../src/lib/email/templates';

// 模板纯函数测试
describe('Email Templates', () => {
  test('welcomeEmail 返回正确的 subject 和 HTML', () => {
    const result = welcomeEmail('Alice');
    expect(result.subject).toBe('Welcome to LabAnimal!');
    expect(result.html).toContain('Alice');
    expect(result.html).toContain('LabAnimal');
    expect(result.html).toContain('#2563eb');
  });

  test('subscriptionConfirmation 包含套餐信息', () => {
    const result = subscriptionConfirmation({
      userName: 'Bob',
      planName: 'Professional',
      amount: '$299/mo',
      periodEnd: '2026-07-27',
    });
    expect(result.subject).toContain('Professional');
    expect(result.html).toContain('Bob');
    expect(result.html).toContain('$299/mo');
    expect(result.html).toContain('2026-07-27');
  });

  test('trialExpiryReminder 根据天数变化 urgency 文案', () => {
    const r1 = trialExpiryReminder({ userName: 'Carol', labName: 'Bio Lab', daysRemaining: 1 });
    expect(r1.subject).toContain('tomorrow');

    const r3 = trialExpiryReminder({ userName: 'Carol', labName: 'Bio Lab', daysRemaining: 3 });
    expect(r3.subject).toContain('3 days');

    const r7 = trialExpiryReminder({ userName: 'Carol', labName: 'Bio Lab', daysRemaining: 7 });
    expect(r7.subject).toContain('7 days');
  });

  test('passwordResetEmail 包含重置链接', () => {
    const link = 'https://labanimal.tech/reset-password?token=abc123';
    const result = passwordResetEmail('Dave', link);
    expect(result.subject).toBe('Reset Your LabAnimal Password');
    expect(result.html).toContain('Dave');
    expect(result.html).toContain(link);
    expect(result.html).toContain('1 hour');
  });
});

// send 函数降级测试（无 API Key 时静默跳过）
describe('Email Send Functions', () => {
  beforeEach(() => {
    // 确保没有 RESEND_API_KEY
    delete process.env.RESEND_API_KEY;
    // 清除模块缓存让 getResend 重新初始化
    vi.resetModules();
  });

  test('sendWelcomeEmail 无 API Key 时静默跳过', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { sendWelcomeEmail } = await import('../src/lib/email/send');
    // 不应抛出异常
    sendWelcomeEmail('test@example.com', 'Test User');

    // 给 fire-and-forget 一点时间
    await new Promise((r) => setTimeout(r, 50));

    expect(errorSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('sendPasswordReset 无 API Key 时静默跳过', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { sendPasswordReset } = await import('../src/lib/email/send');
    sendPasswordReset('test@example.com', 'Test User', 'https://example.com/reset');

    await new Promise((r) => setTimeout(r, 50));
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  test('sendSubscriptionConfirmation 无 API Key 时静默跳过', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { sendSubscriptionConfirmation } = await import('../src/lib/email/send');
    sendSubscriptionConfirmation('test@example.com', {
      userName: 'Test',
      planName: 'Starter',
      amount: '$99/mo',
      periodEnd: '2026-07-27',
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  test('sendTrialExpiryReminder 无 API Key 时静默跳过', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { sendTrialExpiryReminder } = await import('../src/lib/email/send');
    sendTrialExpiryReminder('test@example.com', {
      userName: 'Test',
      labName: 'Test Lab',
      daysRemaining: 3,
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

// 密码重置路由集成测试（需要 API 运行）
import { api } from './helper';

describe('Password Reset Routes', () => {
  test('POST /auth/forgot-password 返回统一消息（不论邮箱是否存在）', async () => {
    const res = await api('POST', '/auth/forgot-password', {
      email: 'nonexistent@example.com',
    });
    expect(res.status).toBe(200);
    expect(res.data.message).toMatch(/reset link/i);
  });

  test('POST /auth/forgot-password 无效邮箱返回 400', async () => {
    const res = await api('POST', '/auth/forgot-password', {
      email: 'not-an-email',
    });
    expect(res.status).toBe(400);
  });

  test('POST /auth/reset-password 无效 token 返回 400', async () => {
    const res = await api('POST', '/auth/reset-password', {
      token: 'invalid-token',
      newPassword: 'NewPass123',
    });
    expect(res.status).toBe(400);
    expect(res.data.error).toMatch(/invalid|expired/i);
  });
});
