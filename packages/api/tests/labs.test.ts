import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, setToken, getToken, loginAsAdmin, createTestInfra } from './helper';

let labId: string;

describe('T14. 实验室模块', () => {
  beforeAll(async () => {
    await loginAsAdmin();
    // 获取已有 lab（admin 通过种子数据已拥有）
    const res = await api('GET', '/animals?labId=test&page=1'); // 用任意请求确认 token 有效
    expect(res.status).not.toBe(401);
  });

  // T14.1 获取实验室列表（通过登录响应获取）
  it('T14.1 登录返回实验室列表', async () => {
    const loginRes = await api('POST', '/auth/login', {
      email: 'admin@demo.lab',
      password: 'password',
    });
    expect(loginRes.status).toBe(200);
    expect(loginRes.data.labs).toBeDefined();
    expect(loginRes.data.labs.length).toBeGreaterThan(0);
    labId = loginRes.data.labs[0].labId;
  });

  // T14.2 获取实验室详情
  it('T14.2 获取实验室详情', async () => {
    const res = await api('GET', `/labs/${labId}`);
    expect(res.status).toBe(200);
    expect(res.data.id).toBe(labId);
    expect(res.data.name).toBeDefined();
    expect(res.data.users).toBeDefined();
  });

  // T14.3 获取不存在的实验室返回 404
  it('T14.3 获取不存在的实验室返回 404', async () => {
    const res = await api('GET', '/labs/nonexistent-id');
    expect(res.status).toBe(404);
  });

  // T14.4 列出实验室成员
  it('T14.4 列出实验室成员', async () => {
    const res = await api('GET', `/labs/${labId}/members`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.data[0].user).toBeDefined();
    expect(res.data[0].role).toBeDefined();
  });

  // T14.5 创建实验室缺少 name 返回 400
  it('T14.5 创建实验室缺少 name 返回 400', async () => {
    const res = await api('POST', '/labs', {});
    expect(res.status).toBe(400);
    expect(res.data.error).toMatch(/name/i);
  });

  // T14.6 添加成员缺少参数返回 400
  it('T14.6 添加成员缺少参数返回 400', async () => {
    const res = await api('POST', `/labs/${labId}/members`, {});
    expect(res.status).toBe(400);
    expect(res.data.error).toMatch(/userId.*role/i);
  });

  // T14.7 添加不存在的用户返回 404
  it('T14.7 添加不存在的用户返回 404', async () => {
    const res = await api('POST', `/labs/${labId}/members`, {
      userId: 'nonexistent-user-id',
      role: 'caretaker',
    });
    expect(res.status).toBe(404);
    expect(res.data.error).toMatch(/user not found/i);
  });

  // T14.8 非成员不能访问实验室详情
  it('T14.8 非成员不能访问实验室详情', async () => {
    // 通过 Prisma 直接创建用户（绕过全局用户限制）
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const bcrypt = await import('bcryptjs');
    const unique = Date.now();

    const hash = await bcrypt.hash('TestPass123!', 10);
    const user = await prisma.user.create({
      data: {
        email: `labtest-${unique}@test.lab`,
        name: 'Lab Tester',
        passwordHash: hash,
      },
    });
    await prisma.$disconnect();

    // 登录获取 token
    const loginRes = await api('POST', '/auth/login', {
      email: `labtest-${unique}@test.lab`,
      password: 'TestPass123!',
    });
    expect(loginRes.status).toBe(200);
    const otherToken = loginRes.data.token;

    // 用新用户的 token 尝试访问 admin 的 lab
    const oldToken = getToken();
    setToken(otherToken);
    const res = await api('GET', `/labs/${labId}`);
    expect(res.status).toBe(403);
    setToken(oldToken);

    // 清理
    const prisma2 = new PrismaClient();
    await prisma2.user.deleteMany({ where: { id: user.id } });
    await prisma2.$disconnect();
  });

  // T14.9 创建新实验室（以新用户身份，他们没有 lab）
  it('T14.9 新用户可以创建第一个实验室', async () => {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const bcrypt = await import('bcryptjs');
    const unique = Date.now();

    // 通过 Prisma 直接创建用户
    const hash = await bcrypt.hash('TestPass123!', 10);
    const user = await prisma.user.create({
      data: {
        email: `newlab-${unique}@test.lab`,
        name: 'New Lab User',
        passwordHash: hash,
      },
    });
    await prisma.$disconnect();

    // 登录获取 token
    const loginRes = await api('POST', '/auth/login', {
      email: `newlab-${unique}@test.lab`,
      password: 'TestPass123!',
    });
    const newToken = loginRes.data.token;

    // 创建实验室
    const oldToken = getToken();
    setToken(newToken);
    const res = await api('POST', '/labs', {
      name: `Test Lab ${unique}`,
      institution: 'Test University',
    });
    expect(res.status).toBe(201);
    expect(res.data.name).toBe(`Test Lab ${unique}`);
    expect(res.data.users).toBeDefined();
    expect(res.data.users[0].role).toBe('pi');

    setToken(oldToken);

    // 清理
    const prisma2 = new PrismaClient();
    await prisma2.userLab.deleteMany({ where: { userId: user.id } });
    await prisma2.lab.deleteMany({ where: { id: res.data.id } });
    await prisma2.user.deleteMany({ where: { id: user.id } });
    await prisma2.$disconnect();
  });

  // T14.10 重复添加成员返回 409
  it('T14.10 重复添加成员返回 409', async () => {
    // 获取 admin 的 userId
    const loginRes = await api('POST', '/auth/login', {
      email: 'admin@demo.lab',
      password: 'password',
    });
    const adminUserId = loginRes.data.user.id;

    // admin 已经是该 lab 的成员，再次添加应返回 409
    const res = await api('POST', `/labs/${labId}/members`, {
      userId: adminUserId,
      role: 'caretaker',
    });
    expect(res.status).toBe(409);
    expect(res.data.error).toMatch(/already/i);
  });
});
