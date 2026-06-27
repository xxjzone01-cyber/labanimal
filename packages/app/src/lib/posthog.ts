/**
 * PostHog 产品分析（条件初始化）
 *
 * 仅在 VITE_POSTHOG_KEY 环境变量配置时启用。
 * 支持页面浏览追踪和自定义事件。
 */

import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;

let initialized = false;

export function initPostHog(): void {
  if (initialized || !POSTHOG_KEY) return;

  posthog.init(POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com',
    capture_pageview: false, // 手动追踪
    capture_pageleave: true,
    autocapture: false, // 仅追踪手动事件
    persistence: 'localStorage',
  });

  initialized = true;
}

/** 追踪页面浏览 */
export function trackPageView(path: string): void {
  if (!initialized) return;
  posthog.capture('$pageview', { $current_url: window.location.origin + path });
}

/** 追踪自定义事件 */
export function trackEvent(event: string, properties?: Record<string, any>): void {
  if (!initialized) return;
  posthog.capture(event, properties);
}

/** 识别用户 */
export function identifyUser(userId: string, properties?: Record<string, any>): void {
  if (!initialized) return;
  posthog.identify(userId, properties);
}

/** 重置用户（登出时调用） */
export function resetUser(): void {
  if (!initialized) return;
  posthog.reset();
}

export { posthog };
