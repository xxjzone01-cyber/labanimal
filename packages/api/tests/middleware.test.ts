import { describe, test, expect } from 'vitest';
import { computeBillingContext, canSignReport, getPlanLimits, FREE_TIER_LIMITS } from '@labanimal/billing';

describe('T16. Billing 中间件逻辑', () => {
  test('T16.1 免费套餐限额正确', () => {
    const limits = getPlanLimits('academic-free');
    expect(limits.maxAnimals).toBe(500);
    expect(limits.maxUsers).toBe(10);
    expect(limits.maxReportsPerMonth).toBe(3);
    expect(limits.hasApiAccess).toBe(false);
    expect(limits.hasAAALACSupport).toBe(false);
  });

  test('T16.2 Starter 套餐限额正确', () => {
    const limits = getPlanLimits('starter');
    expect(limits.maxAnimals).toBe(1000);
    expect(limits.maxUsers).toBe(15);
    expect(limits.maxReportsPerMonth).toBe(-1);
  });

  test('T16.3 未知套餐回退到免费版', () => {
    const limits = getPlanLimits('nonexistent');
    expect(limits).toEqual(FREE_TIER_LIMITS);
  });

  test('T16.4 使用量未超限', () => {
    const ctx = computeBillingContext('academic-free', {
      animalCount: 100,
      userCount: 5,
      reportsThisMonth: 1,
    });
    expect(ctx.isOverLimit).toBe(false);
    expect(ctx.overLimitReasons).toHaveLength(0);
    expect(ctx.plan).toBe('academic-free');
  });

  test('T16.5 动物超限', () => {
    const ctx = computeBillingContext('academic-free', {
      animalCount: 600,
      userCount: 5,
      reportsThisMonth: 1,
    });
    expect(ctx.isOverLimit).toBe(true);
    expect(ctx.overLimitReasons.length).toBeGreaterThan(0);
    expect(ctx.overLimitReasons[0]).toMatch(/Animal limit/);
  });

  test('T16.6 用户超限', () => {
    const ctx = computeBillingContext('academic-free', {
      animalCount: 100,
      userCount: 15,
      reportsThisMonth: 1,
    });
    expect(ctx.isOverLimit).toBe(true);
    expect(ctx.overLimitReasons.some((r) => r.match(/User limit/))).toBe(true);
  });

  test('T16.7 报告超限', () => {
    const ctx = computeBillingContext('academic-free', {
      animalCount: 100,
      userCount: 5,
      reportsThisMonth: 3,
    });
    expect(ctx.isOverLimit).toBe(true);
    expect(ctx.overLimitReasons.some((r) => r.match(/report limit/))).toBe(true);
  });

  test('T16.8 多项同时超限', () => {
    const ctx = computeBillingContext('academic-free', {
      animalCount: 600,
      userCount: 15,
      reportsThisMonth: 5,
    });
    expect(ctx.isOverLimit).toBe(true);
    expect(ctx.overLimitReasons.length).toBe(3);
  });

  test('T16.9 无限套餐永不超限', () => {
    const ctx = computeBillingContext('enterprise-saas', {
      animalCount: 999999,
      userCount: 999999,
      reportsThisMonth: 999999,
    });
    expect(ctx.isOverLimit).toBe(false);
    expect(ctx.overLimitReasons).toHaveLength(0);
  });

  test('T16.10 canSignReport — 未超限返回 true', () => {
    const ctx = computeBillingContext('academic-free', {
      animalCount: 100,
      userCount: 5,
      reportsThisMonth: 1,
    });
    expect(canSignReport(ctx)).toBe(true);
  });

  test('T16.11 canSignReport — 报告超限返回 false', () => {
    const ctx = computeBillingContext('academic-free', {
      animalCount: 100,
      userCount: 5,
      reportsThisMonth: 3,
    });
    expect(canSignReport(ctx)).toBe(false);
  });

  test('T16.12 canSignReport — 无限套餐返回 true', () => {
    const ctx = computeBillingContext('starter', {
      animalCount: 100,
      userCount: 5,
      reportsThisMonth: 999,
    });
    expect(canSignReport(ctx)).toBe(true);
  });

  test('T16.13 canSignReport — null context 返回 true', () => {
    expect(canSignReport(null)).toBe(true);
  });
});
