/**
 * PostgreSQL RLS Multi-Tenant Isolation
 *
 * 双层防护：
 * 1. 应用层：路由使用 getLabId(c) 获取 labId，自动注入查询过滤
 * 2. 数据库层：RLS 策略强制隔离（即使应用层遗漏也安全）
 *
 * 用法：
 *   const labId = getLabId(c);
 *   const animals = await prisma.animal.findMany({ where: { labId } });
 */

import type { Context } from 'hono';
import { getUser } from '../middleware/auth.js';

/**
 * 从请求上下文获取当前 labId
 * 如果未设置 X-Lab-Id header，抛出错误
 */
export function requireLabId(c: Context): string {
  const user = getUser(c);
  if (!user.labId) {
    throw new Error('X-Lab-Id header is required');
  }
  return user.labId;
}

/**
 * 在 Prisma 交互式事务中设置 RLS 上下文
 *
 * 在需要数据库级 RLS 保护的场景使用：
 *   const result = await withRLSTransaction(prisma, labId, async (tx) => {
 *     const animals = await tx.animal.findMany();
 *     return animals;
 *   });
 *
 * @param prisma PrismaClient 实例
 * @param labId 当前实验室 ID
 * @param callback 在事务中执行的回调
 */
export async function withRLSTransaction<T>(
  prisma: { $transaction: (fn: (tx: any) => Promise<T>) => Promise<T> },
  labId: string,
  callback: (tx: any) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_lab = '${labId}'`);
    return callback(tx);
  });
}
