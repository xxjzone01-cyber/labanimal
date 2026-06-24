/**
 * Audit Hash Calculator
 *
 * Provides SHA-256 hashing for audit log integrity verification.
 * Uses the Web Crypto API (available in both Node.js 16+ and browsers).
 *
 * Pattern: Each audit entry's hash includes the previous entry's hash,
 * forming a tamper-evident chain (blockchain-lite pattern).
 */

/**
 * Calculate SHA-256 hash of a string.
 * Returns a hex-encoded hash string.
 *
 * Works in both Node.js 18+ (global crypto) and browsers (window.crypto).
 */
export async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return bufferToHex(hashBuffer);
}

/**
 * Create a hash for an audit log entry.
 *
 * The hash covers: timestamp + entity + action + diff + previousHash
 * This creates a chain where tampering with any entry breaks the chain.
 *
 * @param entry - Audit entry data
 * @returns Hex-encoded SHA-256 hash
 */
export async function hashAuditEntry(entry: {
  timestamp: string;
  entityType: string;
  entityId: string;
  action: string;
  diffJson: string;
  previousHash: string;
}): Promise<string> {
  const payload = [
    entry.timestamp,
    entry.entityType,
    entry.entityId,
    entry.action,
    entry.diffJson,
    entry.previousHash,
  ].join('|');

  return sha256(payload);
}

/**
 * Verify an audit entry's hash against its data.
 *
 * @returns true if the hash matches the data (entry is untampered)
 */
export async function verifyAuditEntry(
  entry: {
    timestamp: string;
    entityType: string;
    entityId: string;
    action: string;
    diffJson: string;
    previousHash: string;
  },
  expectedHash: string
): Promise<boolean> {
  const computed = await hashAuditEntry(entry);
  return computed === expectedHash;
}

/**
 * Genesis hash — used as previousHash for the first entry in the chain.
 */
export const GENESIS_HASH = '0'.repeat(64);

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
