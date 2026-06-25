/**
 * SQLite 数据读取器
 *
 * 使用 sql.js（WebAssembly）读取 SQLite 数据库文件。
 * 自动发现表名，返回结构化数据。
 */

import initSqlJs, { type Database } from 'sql.js';
import { readFileSync } from 'node:fs';

/** SQLite 读取结果：每个表对应一个数组 */
export interface SQLiteData {
  labs: Record<string, unknown>[];
  users: Record<string, unknown>[];
  userLabs: Record<string, unknown>[];
  rooms: Record<string, unknown>[];
  racks: Record<string, unknown>[];
  cages: Record<string, unknown>[];
  protocols: Record<string, unknown>[];
  animals: Record<string, unknown>[];
  healthRecords: Record<string, unknown>[];
  deathReports: Record<string, unknown>[];
  medications: Record<string, unknown>[];
  animalIdentifiers: Record<string, unknown>[];
  animalLinks: Record<string, unknown>[];
  breedings: Record<string, unknown>[];
  enrichments: Record<string, unknown>[];
  trainings: Record<string, unknown>[];
  rates: Record<string, unknown>[];
  electronicSignatures: Record<string, unknown>[];
  batchSessions: Record<string, unknown>[];
  workSessions: Record<string, unknown>[];
  auditLogs: Record<string, unknown>[];
}

/** 表名 → SQLiteData 字段名的映射 */
const TABLE_MAP: Record<string, keyof SQLiteData> = {
  labs: 'labs',
  users: 'users',
  user_labs: 'userLabs',
  rooms: 'rooms',
  racks: 'racks',
  cages: 'cages',
  protocols: 'protocols',
  animals: 'animals',
  health_records: 'healthRecords',
  death_reports: 'deathReports',
  medications: 'medications',
  animal_identifiers: 'animalIdentifiers',
  animal_links: 'animalLinks',
  breeding: 'breedings',
  breedings: 'breedings',
  enrichments: 'enrichments',
  trainings: 'trainings',
  rates: 'rates',
  electronic_signatures: 'electronicSignatures',
  batch_sessions: 'batchSessions',
  work_sessions: 'workSessions',
  audit_log: 'auditLogs',
  audit_logs: 'auditLogs',
};

/** 创建空的 SQLiteData */
function createEmptyData(): SQLiteData {
  return {
    labs: [],
    users: [],
    userLabs: [],
    rooms: [],
    racks: [],
    cages: [],
    protocols: [],
    animals: [],
    healthRecords: [],
    deathReports: [],
    medications: [],
    animalIdentifiers: [],
    animalLinks: [],
    breedings: [],
    enrichments: [],
    trainings: [],
    rates: [],
    electronicSignatures: [],
    batchSessions: [],
    workSessions: [],
    auditLogs: [],
  };
}

/**
 * 从 SQLite 查询结果提取行数据
 */
function extractRows(db: Database, tableName: string): Record<string, unknown>[] {
  try {
    const result = db.exec(`SELECT * FROM "${tableName}"`);
    if (!result || result.length === 0) return [];

    const { columns, values } = result[0];
    return values.map((row: unknown[]) => {
      const obj: Record<string, unknown> = {};
      columns.forEach((col: string, i: number) => {
        obj[col] = row[i];
      });
      return obj;
    });
  } catch {
    // 表不存在或查询失败
    return [];
  }
}

/**
 * 获取数据库中所有用户表名
 */
function getTableNames(db: Database): string[] {
  const result = db.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
  );
  if (!result || result.length === 0) return [];
  return result[0].values.map((row: unknown[]) => String(row[0]));
}

/**
 * 读取 SQLite 数据库文件
 *
 * @param dbPath SQLite 文件路径
 * @returns 结构化数据
 */
export async function readSQLite(dbPath: string): Promise<SQLiteData> {
  const SQL = await initSqlJs();
  const buffer = readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  const data = createEmptyData();
  const tableNames = getTableNames(db);

  for (const tableName of tableNames) {
    const key = TABLE_MAP[tableName];
    if (key) {
      data[key] = extractRows(db, tableName);
    }
    // 未知表名跳过（不影响迁移）
  }

  db.close();
  return data;
}

/**
 * 获取 SQLite 数据库的统计信息（用于 dry-run）
 */
export async function getSQLiteStats(dbPath: string): Promise<Record<string, number>> {
  const SQL = await initSqlJs();
  const buffer = readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  const stats: Record<string, number> = {};
  const tableNames = getTableNames(db);

  for (const tableName of tableNames) {
    const key = TABLE_MAP[tableName];
    if (key) {
      const result = db.exec(`SELECT COUNT(*) FROM "${tableName}"`);
      stats[key] = (result?.[0]?.values?.[0]?.[0] as number) ?? 0;
    }
  }

  db.close();
  return stats;
}
