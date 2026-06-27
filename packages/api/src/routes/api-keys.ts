/**
 * API Keys 管理路由
 *
 * POST   /api/api-keys          — 创建 API Key
 * GET    /api/api-keys          — 列出当前用户的 API Key
 * DELETE /api/api-keys/:id      — 删除 API Key
 * POST   /api/api-keys/:id/rotate — 轮换 API Key
 */

import { Hono } from 'hono';
import { prisma } from '../lib/db.js';
import { authMiddleware, getUser } from '../middleware/auth.js';
import { generateApiKey } from '../lib/api-key.js';

export const apiKeys = new Hono();

// 所有路由需要认证
apiKeys.use('*', authMiddleware);

// 创建 API Key
apiKeys.post('/', async (c) => {
  const user = getUser(c);
  const body = await c.req.json();
  const { name, labId, permissions = 'read', expiresInDays } = body;

  if (!name || !labId) {
    return c.json({ error: 'name and labId are required' }, 400);
  }

  // 验证用户是否属于该实验室
  const userLab = await prisma.userLab.findUnique({
    where: { userId_labId: { userId: user.userId, labId } },
  });

  if (!userLab) {
    return c.json({ error: 'You do not belong to this lab' }, 403);
  }

  // 生成 API Key
  const { key, hash, prefix } = generateApiKey();

  // 计算过期时间
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  // 保存到数据库
  const apiKey = await prisma.apiKey.create({
    data: {
      userId: user.userId,
      labId,
      name,
      keyHash: hash,
      keyPrefix: prefix,
      permissions,
      expiresAt,
    },
  });

  return c.json({
    id: apiKey.id,
    name: apiKey.name,
    key, // 只在创建时返回完整 key
    keyPrefix: prefix,
    permissions: apiKey.permissions,
    expiresAt: apiKey.expiresAt,
    createdAt: apiKey.createdAt,
  }, 201);
});

// 列出当前用户的 API Key
apiKeys.get('/', async (c) => {
  const user = getUser(c);
  const labId = c.req.query('labId');

  const where: any = { userId: user.userId };
  if (labId) where.labId = labId;

  const keys = await prisma.apiKey.findMany({
    where,
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      permissions: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
      labId: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return c.json(keys);
});

// 删除 API Key
apiKeys.delete('/:id', async (c) => {
  const user = getUser(c);
  const id = c.req.param('id');

  const apiKey = await prisma.apiKey.findFirst({
    where: { id, userId: user.userId },
  });

  if (!apiKey) {
    return c.json({ error: 'API Key not found' }, 404);
  }

  await prisma.apiKey.delete({ where: { id } });

  return c.json({ message: 'API Key deleted' });
});

// 轮换 API Key（删除旧的，创建新的）
apiKeys.post('/:id/rotate', async (c) => {
  const user = getUser(c);
  const id = c.req.param('id');

  const oldKey = await prisma.apiKey.findFirst({
    where: { id, userId: user.userId },
  });

  if (!oldKey) {
    return c.json({ error: 'API Key not found' }, 404);
  }

  // 生成新的 API Key
  const { key, hash, prefix } = generateApiKey();

  // 更新数据库
  const newKey = await prisma.apiKey.update({
    where: { id },
    data: {
      keyHash: hash,
      keyPrefix: prefix,
      lastUsedAt: null,
    },
  });

  return c.json({
    id: newKey.id,
    name: newKey.name,
    key, // 只在轮换时返回完整 key
    keyPrefix: prefix,
    permissions: newKey.permissions,
    expiresAt: newKey.expiresAt,
    createdAt: newKey.createdAt,
  });
});
