import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import initSqlJs from 'sql.js';
import { readSQLite, getSQLiteStats } from '../src/readers/sqlite.js';

let dbPath: string;

beforeAll(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();

  // 创建测试表
  db.run(`
    CREATE TABLE labs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      institution TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE animals (
      id TEXT PRIMARY KEY,
      lab_id TEXT NOT NULL,
      internal_id TEXT NOT NULL,
      species TEXT NOT NULL,
      strain TEXT,
      sex TEXT NOT NULL DEFAULT 'unknown',
      status TEXT NOT NULL DEFAULT 'active',
      quarantine_status TEXT NOT NULL DEFAULT 'none',
      is_active INTEGER DEFAULT 1,
      date_of_birth TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE rooms (
      id TEXT PRIMARY KEY,
      lab_id TEXT NOT NULL,
      name TEXT NOT NULL,
      capacity INTEGER,
      temperature_min REAL,
      temperature_max REAL
    )
  `);

  // 插入测试数据
  db.run(`INSERT INTO labs (id, name, institution) VALUES ('lab-1', 'Test Lab', 'MIT')`);

  db.run(`INSERT INTO users (id, email, name, password_hash) VALUES ('user-1', 'admin@test.com', 'Admin User', 'hash123')`);

  db.run(`
    INSERT INTO animals (id, lab_id, internal_id, species, strain, sex, status, quarantine_status, is_active, date_of_birth)
    VALUES
      ('animal-1', 'lab-1', 'M-001', 'mouse', 'C57BL/6', 'male', 'active', 'none', 1, '2024-01-15'),
      ('animal-2', 'lab-1', 'M-002', 'mouse', 'C57BL/6', 'female', 'active', 'quarantined', 1, '2024-02-01'),
      ('animal-3', 'lab-1', 'R-001', 'rat', 'Sprague-Dawley', 'male', 'deceased', 'none', 0, '2023-06-01')
  `);

  db.run(`
    INSERT INTO rooms (id, lab_id, name, capacity, temperature_min, temperature_max)
    VALUES ('room-1', 'lab-1', 'Vivarium A', 100, 20.0, 26.0)
  `);

  // 写入临时文件
  const dir = mkdtempSync(join(tmpdir(), 'labanimal-test-'));
  dbPath = join(dir, 'test.db');
  const data = db.export();
  writeFileSync(dbPath, Buffer.from(data));
  db.close();
});

afterAll(() => {
  try {
    unlinkSync(dbPath);
  } catch {
    // 忽略清理错误
  }
});

describe('readSQLite', () => {
  it('读取所有已知表', async () => {
    const data = await readSQLite(dbPath);

    expect(data.labs).toHaveLength(1);
    expect(data.users).toHaveLength(1);
    expect(data.animals).toHaveLength(3);
    expect(data.rooms).toHaveLength(1);
  });

  it('正确解析字段值', async () => {
    const data = await readSQLite(dbPath);

    expect(data.labs[0].id).toBe('lab-1');
    expect(data.labs[0].name).toBe('Test Lab');
    expect(data.labs[0].institution).toBe('MIT');
  });

  it('缺失的表返回空数组', async () => {
    const data = await readSQLite(dbPath);

    expect(data.protocols).toEqual([]);
    expect(data.healthRecords).toEqual([]);
    expect(data.deathReports).toEqual([]);
    expect(data.medications).toEqual([]);
    expect(data.breedings).toEqual([]);
    expect(data.trainings).toEqual([]);
  });

  it('数值字段正确解析', async () => {
    const data = await readSQLite(dbPath);

    expect(data.animals[0].is_active).toBe(1);
    expect(data.animals[2].is_active).toBe(0);
    expect(data.rooms[0].capacity).toBe(100);
    expect(data.rooms[0].temperature_min).toBe(20.0);
  });

  it('表名映射正确（snake_case → camelCase）', async () => {
    const data = await readSQLite(dbPath);

    // health_records → healthRecords
    expect(Array.isArray(data.healthRecords)).toBe(true);
    // death_reports → deathReports
    expect(Array.isArray(data.deathReports)).toBe(true);
    // animal_identifiers → animalIdentifiers
    expect(Array.isArray(data.animalIdentifiers)).toBe(true);
  });
});

describe('getSQLiteStats', () => {
  it('返回各表记录数', async () => {
    const stats = await getSQLiteStats(dbPath);

    expect(stats.labs).toBe(1);
    expect(stats.users).toBe(1);
    expect(stats.animals).toBe(3);
    expect(stats.rooms).toBe(1);
  });

  it('缺失的表不包含在统计中', async () => {
    const stats = await getSQLiteStats(dbPath);

    expect(stats.protocols).toBeUndefined();
    expect(stats.healthRecords).toBeUndefined();
  });
});
