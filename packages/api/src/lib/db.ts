/**
 * Prisma 客户端单例
 *
 * Prisma 7 要求通过 adapter 连接数据库。
 * 统一从 @labanimal/db 获取带 adapter 的实例。
 */
export { prisma } from '@labanimal/db';
