/**
 * 共享 Resend 客户端（懒加载单例）
 *
 * 未配置 RESEND_API_KEY 时返回 null，由调用方决定降级策略。
 */

import { Resend } from 'resend';

let resendInstance: Resend | null | undefined;

/** 获取 Resend 客户端，未配置时返回 null */
export function getResend(): Resend | null {
  if (resendInstance !== undefined) return resendInstance;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[Email] RESEND_API_KEY not configured, emails will be skipped');
    resendInstance = null;
    return null;
  }

  resendInstance = new Resend(apiKey);
  return resendInstance;
}

/** 获取发件人地址 */
export function getFromEmail(): string {
  return process.env.MAIL_FROM || 'LabAnimal <onboarding@resend.dev>';
}
