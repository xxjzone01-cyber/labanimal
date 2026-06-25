/**
 * Audit Diff Generator
 *
 * Generates structured diffs between old and new values for audit logging.
 * Produces a flat list of changes with field paths (dot notation).
 *
 * Design: Differential storage pattern — only store what changed, not full snapshots.
 * This reduces storage cost for the hot audit log (3-month retention before R2 archive).
 */

export interface DiffEntry {
  /** Dot-notation path of the changed field (e.g., 'address.city') */
  path: string;
  /** Previous value (undefined if field was added) */
  oldValue: unknown;
  /** New value (undefined if field was removed) */
  newValue: unknown;
  /** Type of change */
  changeType: 'added' | 'removed' | 'modified';
}

/**
 * Generate a flat list of differences between two objects.
 *
 * Handles nested objects, arrays, null, and primitive values.
 * Arrays are compared by index (not by content matching).
 *
 * @param oldVal - Previous state (can be any JSON-serializable value)
 * @param newVal - New state
 * @param prefix - Internal path prefix for recursion
 * @returns Array of DiffEntry describing all changes
 */
export function generateDiff(oldVal: unknown, newVal: unknown, prefix = ''): DiffEntry[] {
  // Same reference or same value
  if (oldVal === newVal) return [];

  // Null/undefined/primitive comparison
  if (!isObject(oldVal) || !isObject(newVal)) {
    if (oldVal !== newVal) {
      return [
        {
          path: prefix || '(root)',
          oldValue: oldVal,
          newValue: newVal,
          changeType:
            oldVal === undefined ? 'added' : newVal === undefined ? 'removed' : 'modified',
        },
      ];
    }
    return [];
  }

  // Both are objects — compare keys
  const entries: DiffEntry[] = [];
  const allKeys = new Set([
    ...Object.keys(oldVal as Record<string, unknown>),
    ...Object.keys(newVal as Record<string, unknown>),
  ]);

  for (const key of allKeys) {
    const path = prefix ? `${prefix}.${key}` : key;
    const oldObj = oldVal as Record<string, unknown>;
    const newObj = newVal as Record<string, unknown>;

    if (!(key in oldObj)) {
      // Field added
      entries.push({
        path,
        oldValue: undefined,
        newValue: newObj[key],
        changeType: 'added',
      });
    } else if (!(key in newObj)) {
      // Field removed
      entries.push({
        path,
        oldValue: oldObj[key],
        newValue: undefined,
        changeType: 'removed',
      });
    } else {
      // Both exist — recurse
      entries.push(...generateDiff(oldObj[key], newObj[key], path));
    }
  }

  return entries;
}

/**
 * Generate a human-readable summary of changes.
 */
export function summarizeDiff(entries: DiffEntry[]): string {
  if (entries.length === 0) return 'No changes.';

  const lines = entries.map((e) => {
    switch (e.changeType) {
      case 'added':
        return `+ ${e.path}: ${JSON.stringify(e.newValue)}`;
      case 'removed':
        return `- ${e.path}: ${JSON.stringify(e.oldValue)}`;
      case 'modified':
        return `~ ${e.path}: ${JSON.stringify(e.oldValue)} → ${JSON.stringify(e.newValue)}`;
    }
  });

  return lines.join('\n');
}

function isObject(val: unknown): boolean {
  return val !== null && typeof val === 'object';
}
