import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import initSqlJs from 'sql.js';
import { migrate } from '../src/migrate.js';

let dbPath: string;

beforeAll(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();

  // 创建最小测试数据集
  db.run(`CREATE TABLE labs (id TEXT PRIMARY KEY, name TEXT)`);
  db.run(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE, name TEXT)`);
  db.run(
    `CREATE TABLE animals (id TEXT PRIMARY KEY, lab_id TEXT, internal_id TEXT, species TEXT, sex TEXT, status TEXT, quarantine_status TEXT)`,
  );
  db.run(`CREATE TABLE rooms (id TEXT PRIMARY KEY, lab_id TEXT, name TEXT)`);
  db.run(
    `CREATE TABLE protocols (id TEXT PRIMARY KEY, lab_id TEXT, title TEXT, pi_name TEXT, status TEXT)`,
  );

  db.run(`INSERT INTO labs VALUES ('lab-1', 'Test Lab')`);
  db.run(`INSERT INTO users VALUES ('u1', 'test@test.com', 'Test User')`);
  db.run(`INSERT INTO animals VALUES ('a1', 'lab-1', 'M-001', 'mouse', 'male', 'active', 'none')`);
  db.run(
    `INSERT INTO animals VALUES ('a2', 'lab-1', 'M-002', 'mouse', 'female', 'active', 'none')`,
  );
  db.run(`INSERT INTO rooms VALUES ('r1', 'lab-1', 'Room A')`);
  db.run(`INSERT INTO protocols VALUES ('p1', 'lab-1', 'Test Protocol', 'Dr. Smith', 'approved')`);

  const dir = mkdtempSync(join(tmpdir(), 'labanimal-migrate-'));
  dbPath = join(dir, 'test.db');
  const data = db.export();
  writeFileSync(dbPath, Buffer.from(data));
  db.close();
});

afterAll(() => {
  try {
    unlinkSync(dbPath);
  } catch {
    // 忽略
  }
});

describe('migrate', () => {
  it('dry-run 模式不写入数据', async () => {
    const results = await migrate({
      source: dbPath,
      dryRun: true,
    });

    // dry-run 应该返回结果但不实际写入
    expect(results.length).toBeGreaterThan(0);

    // 检查 animals 表的统计
    const animalResult = results.find((r) => r.table === 'animals');
    expect(animalResult).toBeDefined();
    expect(animalResult!.imported).toBe(2);
    expect(animalResult!.errors).toHaveLength(0);
  });

  it('源文件不存在时抛出错误', async () => {
    await expect(migrate({ source: '/nonexistent/path.db', dryRun: true })).rejects.toThrow(
      '源文件不存在',
    );
  });

  it('无 DATABASE_URL 时抛出错误', async () => {
    const originalUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    await expect(migrate({ source: dbPath })).rejects.toThrow('未指定目标数据库');

    // 恢复
    if (originalUrl) {
      process.env.DATABASE_URL = originalUrl;
    }
  });

  it('dry-run 统计各表记录数', async () => {
    const results = await migrate({
      source: dbPath,
      dryRun: true,
    });

    const tableStats = Object.fromEntries(results.map((r) => [r.table, r.imported]));

    expect(tableStats.labs).toBe(1);
    expect(tableStats.users).toBe(1);
    expect(tableStats.animals).toBe(2);
    expect(tableStats.rooms).toBe(1);
    expect(tableStats.protocols).toBe(1);
  });
});
