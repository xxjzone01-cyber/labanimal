/**
 * @labanimal/db — Prisma 客户端统一入口
 *
 * 所有包通过 `import { prisma, PrismaClient } from '@labanimal/db'` 使用，
 * 不再直接 import '@prisma/client'。
 *
 * 使用懒加载模式：prisma 在首次访问时才初始化，
 * 确保环境变量（如 DATABASE_URL）已正确加载。
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

export { PrismaClient } from '../generated/prisma/client.js';
export type { Prisma, Animal, User, Lab, Protocol, Cage, Room, Rack, Subscription, Invoice, ReportSignature } from '../generated/prisma/client.js';
export {
  CageStatus, AnimalStatus, QuarantineStatus, ProtocolStatus, PainCategory,
  RecordType, TrainingStatus, TrainingType, UserRole, IdentifierType,
  DeathCause, MedicationRoute, SubscriptionStatus, InvoiceStatus,
  SignatureStatus, AuditAction, LicenseCheckResult,
} from '../generated/prisma/enums.js';

/** 创建带 PostgreSQL adapter 的 PrismaClient 实例 */
export function createPrismaClient(databaseUrl?: string): PrismaClient {
  const url = databaseUrl || process.env.DATABASE_URL || '';
  const adapter = new PrismaPg({ connectionString: url });
  return new PrismaClient({ adapter });
}

// ── 懒加载单例 ──────────────────────────────────────────

let _instance: PrismaClient | undefined;

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function initPrisma(): PrismaClient {
  if (process.env.NODE_ENV === 'production') {
    return createPrismaClient();
  }
  if (!global.__prisma) {
    global.__prisma = createPrismaClient();
  }
  return global.__prisma;
}

/**
 * 懒加载 PrismaClient 单例
 *
 * 使用 Proxy 延迟初始化，在首次属性访问时才创建实例。
 * 这样即使模块在环境变量加载前被导入也不会报错。
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    if (!_instance) {
      _instance = initPrisma();
    }
    const value = Reflect.get(_instance, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(_instance);
    }
    return value;
  },
});
