/**
 * License Module — 离线宽限期
 *
 * 离线部署的 License 验证机制：
 * - 首次离线安装：500 只动物 + 1 报告/月
 * - 连续 30 天无网络 → 只读模式
 * - 手动续期码：labanimal.tech/renew 输入 deploy_id 获取 7 天激活码
 *
 * 宽限期数据存储在本地（文件或数据库），不依赖网络。
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/** 离线宽限期状态 */
export interface OfflineGraceState {
  /** 部署 ID */
  deployId: string;
  /** 首次离线时间 (Unix timestamp ms) */
  firstOfflineAt: number;
  /** 最后一次成功在线验证时间 (Unix timestamp ms) */
  lastOnlineAt: number;
  /** 宽限期截止时间 (Unix timestamp ms) = firstOfflineAt + 30天 */
  graceExpiresAt: number;
  /** 是否处于只读模式 */
  readOnly: boolean;
  /** 续期码激活的截止时间 (如果有) */
  renewalExpiresAt?: number;
}

/** 续期码数据 */
export interface RenewalCode {
  /** 部署 ID */
  deployId: number;
  /** 激活截止时间 (Unix timestamp ms) */
  expiresAt: number;
  /** HMAC 签名 */
  signature: string;
}

/** 宽限期：30 天 (ms) */
const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/** 续期码有效期：7 天 (ms) */
const RENEWAL_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

/** 首次离线限额 */
export const OFFLINE_LIMITS = {
  maxAnimals: 500,
  maxReportsPerMonth: 1,
};

/**
 * 初始化离线宽限期状态
 *
 * @param deployId 部署 ID
 * @returns 初始宽限期状态
 */
export function initOfflineGrace(deployId: string): OfflineGraceState {
  const now = Date.now();
  return {
    deployId,
    firstOfflineAt: now,
    lastOnlineAt: now,
    graceExpiresAt: now + GRACE_PERIOD_MS,
    readOnly: false,
  };
}

/**
 * 更新宽限期状态（每次在线验证成功后调用）
 *
 * @param state 当前状态
 * @returns 更新后的状态（重置宽限期）
 */
export function updateOnlineStatus(state: OfflineGraceState): OfflineGraceState {
  const now = Date.now();
  return {
    ...state,
    lastOnlineAt: now,
    graceExpiresAt: now + GRACE_PERIOD_MS,
    readOnly: false,
    renewalExpiresAt: undefined,
  };
}

/**
 * 检查宽限期状态
 *
 * @param state 当前状态
 * @returns 是否应该进入只读模式
 */
export function checkGraceStatus(state: OfflineGraceState): {
  inGracePeriod: boolean;
  readOnly: boolean;
  daysRemaining: number;
} {
  const now = Date.now();

  // 检查续期码是否有效
  if (state.renewalExpiresAt && state.renewalExpiresAt > now) {
    return {
      inGracePeriod: true,
      readOnly: false,
      daysRemaining: Math.ceil((state.renewalExpiresAt - now) / (24 * 60 * 60 * 1000)),
    };
  }

  // 检查宽限期
  if (now < state.graceExpiresAt) {
    return {
      inGracePeriod: true,
      readOnly: false,
      daysRemaining: Math.ceil((state.graceExpiresAt - now) / (24 * 60 * 60 * 1000)),
    };
  }

  // 宽限期已过，进入只读模式
  return {
    inGracePeriod: false,
    readOnly: true,
    daysRemaining: 0,
  };
}

/**
 * 生成续期码
 *
 * @param deployId 部署 ID
 * @param secret 续期密钥（服务端持有）
 * @returns 续期码字符串（可发送给用户）
 */
export function generateRenewalCode(deployId: string, secret: string): string {
  const expiresAt = Date.now() + RENEWAL_PERIOD_MS;
  const payload = `${deployId}:${expiresAt}`;
  const hmac = createHmac('sha256', secret).update(payload).digest('hex');
  const code: RenewalCode = { deployId: 0, expiresAt, signature: hmac };
  // 编码为 Base64URL
  return Buffer.from(JSON.stringify({ ...code, deployId })).toString('base64url');
}

/**
 * 验证续期码
 *
 * @param code 续期码字符串
 * @param expectedDeployId 期望的部署 ID
 * @param secret 续期密钥
 * @returns 验证结果
 */
export function verifyRenewalCode(
  code: string,
  expectedDeployId: string,
  secret: string,
): { valid: boolean; expiresAt?: number; error?: string } {
  try {
    const decoded = JSON.parse(Buffer.from(code, 'base64url').toString('utf8')) as RenewalCode & {
      deployId: string;
    };

    // 验证部署 ID
    if (decoded.deployId !== expectedDeployId) {
      return { valid: false, error: 'deploy_id_mismatch' };
    }

    // 验证过期时间
    if (decoded.expiresAt < Date.now()) {
      return { valid: false, error: 'expired' };
    }

    // 验证 HMAC
    const payload = `${decoded.deployId}:${decoded.expiresAt}`;
    const expectedHmac = createHmac('sha256', secret).update(payload).digest('hex');

    const sigBuffer = Buffer.from(decoded.signature, 'hex');
    const expectedBuffer = Buffer.from(expectedHmac, 'hex');

    if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
      return { valid: false, error: 'invalid_signature' };
    }

    return { valid: true, expiresAt: decoded.expiresAt };
  } catch {
    return { valid: false, error: 'malformed' };
  }
}
