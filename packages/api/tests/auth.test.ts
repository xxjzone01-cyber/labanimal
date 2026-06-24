import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { api, setToken, clearAuth } from './helper';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('T1. 认证模块', () => {
  const testEmail = `test-auth-${Date.now()}@test.lab`;

  beforeAll(async () => {
    // 清理之前测试遗留的用户，确保不超限
    await prisma.user.deleteMany({
      where: { email: { contains: '@test.lab' } },
    });
  });

  afterAll(async () => {
    // 清理本次测试创建的用户
    await prisma.user.deleteMany({
      where: { email: { contains: '@test.lab' } },
    });
    await prisma.$disconnect();
  });

  test('T1.1 注册成功', async () => {
    const res = await api('POST', '/auth/register', {
      email: testEmail,
      password: 'TestPass123!',
      name: 'Test User',
    });
    expect(res.status).toBe(201);
    expect(res.data.user.email).toBe(testEmail);
    expect(res.data.token).toBeTruthy();
    expect(res.data.labs).toBeDefined();
  });

  test('T1.2 注册重复邮箱', async () => {
    const res = await api('POST', '/auth/register', {
      email: testEmail,
      password: 'TestPass123!',
      name: 'Test User 2',
    });
    expect(res.status).toBe(409);
    expect(res.data.error).toMatch(/already registered/i);
  });

  test('T1.3 注册缺字段', async () => {
    const res = await api('POST', '/auth/register', {
      email: 'no-pass@test.lab',
    });
    expect(res.status).toBe(400);
  });

  test('T1.5 登录成功', async () => {
    const res = await api('POST', '/auth/login', {
      email: 'admin@demo.lab',
      password: 'password',
    });
    expect(res.status).toBe(200);
    expect(res.data.token).toBeTruthy();
    expect(res.data.user.email).toBe('admin@demo.lab');
    expect(res.data.labs).toBeInstanceOf(Array);
    expect(res.data.labs.length).toBeGreaterThan(0);
    expect(res.data.labs[0].labId).toBeTruthy();
  });

  test('T1.6 登录密码错误', async () => {
    const res = await api('POST', '/auth/login', {
      email: 'admin@demo.lab',
      password: 'wrongpassword',
    });
    expect(res.status).toBe(401);
    expect(res.data.error).toMatch(/invalid/i);
  });

  test('T1.7 登录邮箱不存在', async () => {
    const res = await api('POST', '/auth/login', {
      email: 'nonexistent@test.lab',
      password: 'password',
    });
    expect(res.status).toBe(401);
  });

  test('T1.8 无 token 访问受保护端点', async () => {
    clearAuth();
    const res = await api('GET', '/animals?labId=test');
    expect(res.status).toBe(401);
  });

  test('T1.9 无效 token', async () => {
    const oldToken = (await import('./helper')).getToken();
    setToken('invalid-token-12345');
    const res = await api('GET', '/animals?labId=test');
    expect(res.status).toBe(401);
    setToken(oldToken);
  });
});
