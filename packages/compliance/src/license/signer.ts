/**
 * License Module — JWT 签名与验签
 *
 * 自实现轻量 JWT，不引入任何外部依赖。
 * 算法固定为 RS256，防止 algorithm confusion 攻击（CVE-2015-9235）。
 */

import { createSign, createVerify } from 'node:crypto';
import type { LicensePayload, LicenseVerification } from './types.js';

/** JWT Header（算法固定为 RS256） */
const JWT_HEADER = { alg: 'RS256', typ: 'JWT' };

/** 允许的算法 — 硬编码，不可从 token 中读取 */
const ALLOWED_ALGORITHM = 'RS256';

/**
 * Base64URL 编码
 */
function base64UrlEncode(data: string): string {
  return Buffer.from(data, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Base64URL 解码
 */
function base64UrlDecode(data: string): string {
  const padded = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64').toString('utf8');
}

/**
 * 签发 License JWT
 *
 * @param payload License 载荷
 * @param privateKeyPem PEM 格式的 RSA 私钥
 * @returns JWT 字符串
 */
export async function signLicense(
  payload: LicensePayload,
  privateKeyPem: string
): Promise<string> {
  const headerB64 = base64UrlEncode(JSON.stringify(JWT_HEADER));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));

  const signingInput = `${headerB64}.${payloadB64}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  const signature = signer.sign(privateKeyPem, 'base64url');

  return `${signingInput}.${signature}`;
}

/**
 * 验证 License JWT
 *
 * 安全规则：
 * 1. 算法必须为 RS256（硬编码，不从 header 读取）
 * 2. 签名必须有效
 * 3. 过期时间必须大于当前时间
 *
 * @param jwt JWT 字符串
 * @param publicKeyPem PEM 格式的 RSA 公钥
 * @returns 验证结果
 */
export async function verifyLicense(
  jwt: string,
  publicKeyPem: string
): Promise<LicenseVerification> {
  // 1. 拆分 JWT
  const parts = jwt.split('.');
  if (parts.length !== 3) {
    return { valid: false, payload: null, error: 'malformed' };
  }

  const [headerB64, payloadB64, signature] = parts;

  // 2. 解析并验证 header（算法必须为 RS256）
  let header: { alg: string; typ?: string };
  try {
    header = JSON.parse(base64UrlDecode(headerB64));
  } catch {
    return { valid: false, payload: null, error: 'malformed' };
  }

  if (header.alg !== ALLOWED_ALGORITHM) {
    return { valid: false, payload: null, error: 'algorithm_not_allowed' };
  }

  // 3. 验证签名（使用硬编码算法，忽略 header 中的 alg）
  const signingInput = `${headerB64}.${payloadB64}`;
  const verifier = createVerify('RSA-SHA256');
  verifier.update(signingInput);

  let signatureValid: boolean;
  try {
    signatureValid = verifier.verify(publicKeyPem, signature, 'base64url');
  } catch {
    return { valid: false, payload: null, error: 'invalid_signature' };
  }

  if (!signatureValid) {
    return { valid: false, payload: null, error: 'invalid_signature' };
  }

  // 4. 解析 payload
  let payload: LicensePayload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64));
  } catch {
    return { valid: false, payload: null, error: 'malformed' };
  }

  // 5. 验证必填字段
  if (
    typeof payload.deployId !== 'string' ||
    typeof payload.maxAnimals !== 'number' ||
    typeof payload.maxReportsPerMonth !== 'number' ||
    !Array.isArray(payload.complianceModules) ||
    typeof payload.issuedAt !== 'number' ||
    typeof payload.expiresAt !== 'number'
  ) {
    return { valid: false, payload: null, error: 'malformed' };
  }

  // 6. 检查过期时间
  const now = Math.floor(Date.now() / 1000);
  if (payload.expiresAt < now) {
    return { valid: false, payload: null, error: 'expired' };
  }

  return { valid: true, payload };
}
