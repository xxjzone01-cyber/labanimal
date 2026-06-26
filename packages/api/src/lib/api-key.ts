/**
 * API Key 工具函数
 *
 * 生成、哈希和验证 API Key
 */

import { createHash, randomBytes } from 'node:crypto';

/**
 * 生成 API Key
 * 格式: la_live_<random> 或 la_test_<random>
 */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const env = process.env.NODE_ENV === 'production' ? 'live' : 'test';
  const random = randomBytes(32).toString('hex');
  const key = `la_${env}_${random}`;
  const prefix = key.substring(0, 12); // la_live_xxxx 或 la_test_xxxx
  const hash = hashApiKey(key);

  return { key, hash, prefix };
}

/**
 * 哈希 API Key（SHA-256）
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * 验证 API Key
 */
export function verifyApiKey(key: string, hash: string): boolean {
  const keyHash = hashApiKey(key);
  return keyHash === hash;
}
