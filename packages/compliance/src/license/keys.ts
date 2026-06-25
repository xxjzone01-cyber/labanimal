/**
 * License Module — RSA Key Management
 *
 * 使用 Node.js 内置 crypto 模块生成和管理 RSA-2048 密钥对。
 * 返回 PEM 格式，可直接用于 JWT 签名和报告签名。
 */

import { generateKeyPairSync, createPublicKey, createPrivateKey } from 'node:crypto';

/** RSA 密钥对（PEM 格式） */
export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

/**
 * 生成 RSA-2048 密钥对
 * @returns PEM 格式的公钥和私钥
 */
export function generateKeyPair(): KeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKey, privateKey };
}

/**
 * 验证 PEM 格式的公钥是否有效
 * @param pem PEM 格式的公钥
 * @returns 是否为有效的 RSA 公钥
 */
export function isValidPublicKey(pem: string): boolean {
  // 只接受公钥 PEM，拒绝私钥（createPublicKey 会从私钥中提取公钥）
  if (
    !pem.includes('-----BEGIN PUBLIC KEY-----') &&
    !pem.includes('-----BEGIN RSA PUBLIC KEY-----')
  ) {
    return false;
  }
  try {
    const key = createPublicKey(pem);
    return key.asymmetricKeyType === 'rsa';
  } catch {
    return false;
  }
}

/**
 * 验证 PEM 格式的私钥是否有效
 * @param pem PEM 格式的私钥
 * @returns 是否为有效的 RSA 私钥
 */
export function isValidPrivateKey(pem: string): boolean {
  try {
    const key = createPrivateKey(pem);
    return key.asymmetricKeyType === 'rsa';
  } catch {
    return false;
  }
}
