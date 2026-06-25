/**
 * License Module — 报告签名
 *
 * 报告签名用于验证 PDF 报告的真实性和完整性。
 * 签名数据嵌入 PDF 页脚，包含二维码链接到 labanimal.tech/verify?hash=xxx。
 *
 * 防重放攻击：签名包含时间戳，验证窗口为 24 小时。
 */

import { createSign, createVerify } from 'node:crypto';
import type { ReportSignatureData, ReportSignatureVerification } from './types.js';

/** 签名有效期：24 小时（毫秒） */
const SIGNATURE_VALIDITY_MS = 24 * 60 * 60 * 1000;

/** 验证页面基础 URL */
const VERIFY_BASE_URL = 'https://labanimal.tech/verify';

/**
 * 生成报告签名
 *
 * @param reportHash 报告内容的 SHA-256 哈希
 * @param deployId 部署 ID
 * @param privateKeyPem PEM 格式的 RSA 私钥
 * @returns Base64 编码的签名数据（嵌入 PDF）
 */
export async function signReport(
  reportHash: string,
  deployId: string,
  privateKeyPem: string,
): Promise<string> {
  const data: ReportSignatureData = {
    reportHash,
    deployId,
    signedAt: Date.now(),
    status: 'verified',
  };

  const payload = JSON.stringify(data);
  const signer = createSign('RSA-SHA256');
  signer.update(payload);
  const signature = signer.sign(privateKeyPem, 'base64');

  // 签名数据 = payload + "|" + signature
  const signedPayload = `${payload}|${signature}`;
  return Buffer.from(signedPayload, 'utf8').toString('base64');
}

/**
 * 验证报告签名
 *
 * @param signatureBase64 Base64 编码的签名数据
 * @param publicKeyPem PEM 格式的 RSA 公钥
 * @param reportHash 可选：要验证的报告哈希（如果不提供，只验证签名有效性）
 * @returns 验证结果
 */
export async function verifyReportSignature(
  signatureBase64: string,
  publicKeyPem: string,
  reportHash?: string,
): Promise<ReportSignatureVerification> {
  const emptyResult = (
    error: ReportSignatureVerification['error'],
  ): ReportSignatureVerification => ({
    valid: false,
    data: null,
    verifyUrl: '',
    error,
  });

  // 1. Base64 解码
  let signedPayload: string;
  try {
    signedPayload = Buffer.from(signatureBase64, 'base64').toString('utf8');
  } catch {
    return emptyResult('invalid_signature');
  }

  // 2. 拆分 payload 和 signature
  const lastPipe = signedPayload.lastIndexOf('|');
  if (lastPipe === -1) {
    return emptyResult('invalid_signature');
  }

  const payload = signedPayload.substring(0, lastPipe);
  const signature = signedPayload.substring(lastPipe + 1);

  // 3. 解析签名数据（在验签前解析，以便处理 unverified 状态）
  let data: ReportSignatureData;
  try {
    data = JSON.parse(payload);
  } catch {
    return emptyResult('invalid_signature');
  }

  // 4. 验证必填字段
  if (
    typeof data.reportHash !== 'string' ||
    typeof data.deployId !== 'string' ||
    typeof data.signedAt !== 'number' ||
    (data.status !== 'verified' && data.status !== 'unverified')
  ) {
    return emptyResult('invalid_signature');
  }

  // 5. 未验证状态：无签名，跳过 RSA 验证
  if (data.status === 'unverified' && signature === '') {
    // 直接返回 unverified 错误（不检查时间窗口）
    return {
      valid: false,
      data,
      verifyUrl: `${VERIFY_BASE_URL}?hash=${data.reportHash}`,
      error: 'unverified',
    };
  }

  // 6. 已验证状态：验证 RSA 签名
  if (signature === '') {
    return emptyResult('invalid_signature');
  }

  const verifier = createVerify('RSA-SHA256');
  verifier.update(payload);

  let signatureValid: boolean;
  try {
    signatureValid = verifier.verify(publicKeyPem, signature, 'base64');
  } catch {
    return emptyResult('invalid_signature');
  }

  if (!signatureValid) {
    return emptyResult('invalid_signature');
  }

  // 7. 检查时间窗口（24 小时有效期，防重放）
  const now = Date.now();
  if (now - data.signedAt > SIGNATURE_VALIDITY_MS) {
    return {
      valid: false,
      data,
      verifyUrl: `${VERIFY_BASE_URL}?hash=${data.reportHash}`,
      error: 'signature_expired',
    };
  }

  // 8. 如果提供了报告哈希，验证是否匹配
  if (reportHash && data.reportHash !== reportHash) {
    return {
      valid: false,
      data,
      verifyUrl: `${VERIFY_BASE_URL}?hash=${data.reportHash}`,
      error: 'tampered',
    };
  }

  return {
    valid: true,
    data,
    verifyUrl: `${VERIFY_BASE_URL}?hash=${data.reportHash}`,
  };
}

/**
 * 生成未验证报告的签名数据（用于未授权部署）
 *
 * @param reportHash 报告内容的 SHA-256 哈希
 * @param deployId 部署 ID
 * @returns Base64 编码的未验证签名数据
 */
export async function signReportUnverified(reportHash: string, deployId: string): Promise<string> {
  const data: ReportSignatureData = {
    reportHash,
    deployId,
    signedAt: Date.now(),
    status: 'unverified',
  };
  // 与签名格式保持一致：payload|（空签名）
  const signedPayload = `${JSON.stringify(data)}|`;
  return Buffer.from(signedPayload, 'utf8').toString('base64');
}
