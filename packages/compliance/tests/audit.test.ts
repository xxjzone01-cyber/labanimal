import { describe, it, expect } from 'vitest';
import { generateDiff, summarizeDiff } from '../src/audit/diff.js';
import { sha256, hashAuditEntry, verifyAuditEntry, GENESIS_HASH } from '../src/audit/hash.js';

// ========== generateDiff ==========

describe('generateDiff', () => {
  it('returns empty array for identical primitives', () => {
    expect(generateDiff(42, 42)).toEqual([]);
    expect(generateDiff('abc', 'abc')).toEqual([]);
    expect(generateDiff(null, null)).toEqual([]);
  });

  it('detects primitive value change', () => {
    const diff = generateDiff('old', 'new');
    expect(diff).toHaveLength(1);
    expect(diff[0].changeType).toBe('modified');
    expect(diff[0].oldValue).toBe('old');
    expect(diff[0].newValue).toBe('new');
  });

  it('detects null to value change', () => {
    const diff = generateDiff(null, 'hello');
    expect(diff).toHaveLength(1);
    expect(diff[0].changeType).toBe('modified');
  });

  it('detects value to null change', () => {
    const diff = generateDiff('hello', null);
    expect(diff).toHaveLength(1);
    expect(diff[0].changeType).toBe('modified');
  });

  it('detects added field in object', () => {
    const diff = generateDiff({}, { name: 'Alice' });
    expect(diff).toHaveLength(1);
    expect(diff[0]).toEqual({
      path: 'name',
      oldValue: undefined,
      newValue: 'Alice',
      changeType: 'added',
    });
  });

  it('detects removed field in object', () => {
    const diff = generateDiff({ name: 'Alice' }, {});
    expect(diff).toHaveLength(1);
    expect(diff[0]).toEqual({
      path: 'name',
      oldValue: 'Alice',
      newValue: undefined,
      changeType: 'removed',
    });
  });

  it('detects modified field in object', () => {
    const diff = generateDiff({ age: 25 }, { age: 30 });
    expect(diff).toHaveLength(1);
    expect(diff[0]).toEqual({
      path: 'age',
      oldValue: 25,
      newValue: 30,
      changeType: 'modified',
    });
  });

  it('handles nested objects with dot notation', () => {
    const old = { user: { name: 'Alice', age: 25 } };
    const updated = { user: { name: 'Bob', age: 25 } };
    const diff = generateDiff(old, updated);
    expect(diff).toHaveLength(1);
    expect(diff[0].path).toBe('user.name');
    expect(diff[0].oldValue).toBe('Alice');
    expect(diff[0].newValue).toBe('Bob');
  });

  it('handles multiple changes across nested objects', () => {
    const old = { a: 1, b: { x: 10, y: 20 }, c: 'keep' };
    const updated = { a: 2, b: { x: 10, y: 30 }, c: 'keep' };
    const diff = generateDiff(old, updated);
    expect(diff).toHaveLength(2);
    expect(diff.map((d) => d.path)).toContain('a');
    expect(diff.map((d) => d.path)).toContain('b.y');
  });

  it('returns empty for identical objects', () => {
    const obj = { a: 1, b: { c: 2 } };
    expect(generateDiff(obj, obj)).toEqual([]);
  });

  it('handles arrays compared by index', () => {
    const diff = generateDiff([1, 2, 3], [1, 5, 3]);
    expect(diff).toHaveLength(1);
    expect(diff[0].path).toBe('1');
    expect(diff[0].oldValue).toBe(2);
    expect(diff[0].newValue).toBe(5);
  });

  it('handles array length changes', () => {
    const diff = generateDiff([1, 2], [1, 2, 3]);
    expect(diff).toHaveLength(1);
    expect(diff[0].changeType).toBe('added');
    expect(diff[0].path).toBe('2');
  });

  it('uses (root) as path for top-level primitive diff', () => {
    const diff = generateDiff(1, 2);
    expect(diff[0].path).toBe('(root)');
  });

  it('handles type change (object to primitive)', () => {
    const diff = generateDiff({ a: 1 }, 'not an object');
    // When old is object and new is not, they're compared at root level
    expect(diff.length).toBeGreaterThan(0);
  });
});

// ========== summarizeDiff ==========

describe('summarizeDiff', () => {
  it('returns "No changes." for empty diff', () => {
    expect(summarizeDiff([])).toBe('No changes.');
  });

  it('formats added fields', () => {
    const summary = summarizeDiff([
      { path: 'name', oldValue: undefined, newValue: 'Alice', changeType: 'added' },
    ]);
    expect(summary).toBe('+ name: "Alice"');
  });

  it('formats removed fields', () => {
    const summary = summarizeDiff([
      { path: 'name', oldValue: 'Alice', newValue: undefined, changeType: 'removed' },
    ]);
    expect(summary).toBe('- name: "Alice"');
  });

  it('formats modified fields', () => {
    const summary = summarizeDiff([
      { path: 'age', oldValue: 25, newValue: 30, changeType: 'modified' },
    ]);
    expect(summary).toBe('~ age: 25 → 30');
  });

  it('formats multiple changes on separate lines', () => {
    const summary = summarizeDiff([
      { path: 'a', oldValue: 1, newValue: 2, changeType: 'modified' },
      { path: 'b', oldValue: undefined, newValue: 'new', changeType: 'added' },
    ]);
    expect(summary).toContain('~ a: 1 → 2');
    expect(summary).toContain('+ b: "new"');
  });
});

// ========== sha256 ==========

describe('sha256', () => {
  it('returns a 64-character hex string', async () => {
    const hash = await sha256('hello');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns consistent hashes for same input', async () => {
    const hash1 = await sha256('test');
    const hash2 = await sha256('test');
    expect(hash1).toBe(hash2);
  });

  it('returns different hashes for different inputs', async () => {
    const hash1 = await sha256('hello');
    const hash2 = await sha256('world');
    expect(hash1).not.toBe(hash2);
  });

  it('produces known hash for "hello"', async () => {
    // Known SHA-256 of "hello"
    const expected = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';
    const hash = await sha256('hello');
    expect(hash).toBe(expected);
  });
});

// ========== hashAuditEntry ==========

describe('hashAuditEntry', () => {
  const sampleEntry = {
    timestamp: '2026-01-15T10:30:00Z',
    entityType: 'animal',
    entityId: 'anim-001',
    action: 'update',
    diffJson: '{"status":{"old":"active","new":"deceased"}}',
    previousHash: GENESIS_HASH,
  };

  it('returns a 64-char hex hash', async () => {
    const hash = await hashAuditEntry(sampleEntry);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces different hashes for different entries', async () => {
    const hash1 = await hashAuditEntry(sampleEntry);
    const hash2 = await hashAuditEntry({ ...sampleEntry, action: 'create' });
    expect(hash1).not.toBe(hash2);
  });

  it('is deterministic', async () => {
    const hash1 = await hashAuditEntry(sampleEntry);
    const hash2 = await hashAuditEntry(sampleEntry);
    expect(hash1).toBe(hash2);
  });
});

// ========== verifyAuditEntry ==========

describe('verifyAuditEntry', () => {
  const entry = {
    timestamp: '2026-01-15T10:30:00Z',
    entityType: 'animal',
    entityId: 'anim-001',
    action: 'update',
    diffJson: '{}',
    previousHash: GENESIS_HASH,
  };

  it('returns true for valid entry', async () => {
    const hash = await hashAuditEntry(entry);
    const valid = await verifyAuditEntry(entry, hash);
    expect(valid).toBe(true);
  });

  it('returns false for tampered entry', async () => {
    const hash = await hashAuditEntry(entry);
    const tampered = { ...entry, action: 'delete' };
    const valid = await verifyAuditEntry(tampered, hash);
    expect(valid).toBe(false);
  });

  it('returns false for wrong hash', async () => {
    const valid = await verifyAuditEntry(entry, 'a'.repeat(64));
    expect(valid).toBe(false);
  });
});

// ========== GENESIS_HASH ==========

describe('GENESIS_HASH', () => {
  it('is 64 zeros', () => {
    expect(GENESIS_HASH).toBe('0'.repeat(64));
    expect(GENESIS_HASH).toHaveLength(64);
  });
});
