/**
 * 迁移编排器
 *
 * 读取 → 映射 → 写入的完整流程。
 */

import { existsSync } from 'node:fs';
import { readSQLite, getSQLiteStats } from './readers/sqlite.js';
import { writePostgres, type MigrationResult } from './writers/postgres.js';

/** 迁移选项 */
export interface MigrateOptions {
  /** SQLite 文件路径 */
  source: string;
  /** PostgreSQL 连接字符串（可选，默认使用 DATABASE_URL 环境变量） */
  target?: string;
  /** 目标实验室 ID（可选，不提供则自动生成） */
  labId?: string;
  /** 新实验室名称 */
  labName?: string;
  /** 试运行，不实际写入 */
  dryRun?: boolean;
  /** 跳过审计日志迁移 */
  skipAuditLog?: boolean;
}

/**
 * 执行数据迁移
 */
export async function migrate(options: MigrateOptions): Promise<MigrationResult[]> {
  const { source, dryRun, skipAuditLog } = options;

  // 验证源文件
  if (!existsSync(source)) {
    throw new Error(`源文件不存在: ${source}`);
  }

  // 设置目标数据库连接
  if (options.target) {
    process.env.DATABASE_URL = options.target;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('未指定目标数据库。使用 --to 参数或设置 DATABASE_URL 环境变量');
  }

  // 生成或使用指定的 labId
  const labId = options.labId ?? generateId();

  // 读取源数据
  console.log(`正在读取 SQLite 数据库: ${source}`);
  const data = await readSQLite(source);

  // 统计
  const stats = {
    labs: data.labs.length,
    users: data.users.length,
    userLabs: data.userLabs.length,
    rooms: data.rooms.length,
    racks: data.racks.length,
    cages: data.cages.length,
    protocols: data.protocols.length,
    animals: data.animals.length,
    healthRecords: data.healthRecords.length,
    deathReports: data.deathReports.length,
    medications: data.medications.length,
    animalIdentifiers: data.animalIdentifiers.length,
    animalLinks: data.animalLinks.length,
    breedings: data.breedings.length,
    enrichments: data.enrichments.length,
    trainings: data.trainings.length,
    rates: data.rates.length,
    electronicSignatures: data.electronicSignatures.length,
    batchSessions: data.batchSessions.length,
    workSessions: data.workSessions.length,
    auditLogs: data.auditLogs.length,
  };

  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  console.log(`\n发现 ${total} 条记录：`);
  for (const [table, count] of Object.entries(stats)) {
    if (count > 0) {
      console.log(`  ${table}: ${count}`);
    }
  }

  if (total === 0) {
    console.log('\n源数据库为空，无需迁移。');
    return [];
  }

  if (dryRun) {
    console.log('\n[DRY RUN] 试运行模式，不会实际写入数据。');
  }

  // 执行写入
  console.log(`\n目标: PostgreSQL (labId: ${labId})`);
  const results = await writePostgres(data, labId, { dryRun, skipAuditLog });

  // 输出结果
  console.log('\n迁移结果:');
  let totalImported = 0;
  let totalErrors = 0;

  for (const result of results) {
    if (result.imported > 0 || result.skipped > 0 || result.errors.length > 0) {
      const status = result.errors.length > 0 ? '⚠' : '✓';
      console.log(`  ${status} ${result.table}: ${result.imported} 导入, ${result.skipped} 跳过`);
      if (result.errors.length > 0) {
        for (const err of result.errors) {
          console.log(`    ✗ ${err}`);
        }
      }
      totalImported += result.imported;
      totalErrors += result.errors.length;
    }
  }

  console.log(`\n总计: ${totalImported} 条记录${dryRun ? ' (预估)' : ' 已导入'}`);
  if (totalErrors > 0) {
    console.log(`警告: ${totalErrors} 条记录导入失败`);
  }

  return results;
}

/**
 * 生成 CUID 风格的 ID
 */
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `c${timestamp}${random}`;
}

export { getSQLiteStats };
