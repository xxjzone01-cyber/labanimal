/**
 * License Module
 *
 * License JWT 签发/验签 + 报告签名生成/验证。
 * 零外部依赖，使用 Node.js 内置 crypto 模块。
 */

export type {
  LicensePayload,
  LicenseVerification,
  ReportSignatureData,
  ReportSignatureVerification,
} from './types.js';

export { generateKeyPair, isValidPublicKey, isValidPrivateKey } from './keys.js';
export type { KeyPair } from './keys.js';

export { signLicense, verifyLicense } from './signer.js';

export { signReport, verifyReportSignature, signReportUnverified } from './report-signature.js';

export {
  initOfflineGrace,
  updateOnlineStatus,
  checkGraceStatus,
  generateRenewalCode,
  verifyRenewalCode,
  OFFLINE_LIMITS,
} from './offline-grace.js';
export type { OfflineGraceState, RenewalCode } from './offline-grace.js';
