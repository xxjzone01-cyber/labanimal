/**
 * 共享邮件客户端（懒加载单例）
 *
 * 优先级：
 *   1. 腾讯云 SES API（TENCENT_SECRET_ID + TENCENT_SECRET_KEY）
 *   2. Brevo REST API（BREVO_API_KEY）
 *   3. 未配置时返回 null，由调用方决定降级策略
 *
 * 接口统一为 { emails: { send(params) } }，与原 Resend SDK 兼容。
 */

import { createHmac, createHash } from 'node:crypto';

interface EmailSendParams {
  from: string;
  to: string;
  subject: string;
  html: string;
}

interface EmailClient {
  emails: {
    send: (params: EmailSendParams) => Promise<void>;
  };
}

let clientInstance: EmailClient | null | undefined;

/** 解析 "Name <email@example.com>" 格式 */
function parseFrom(from: string): { name?: string; email: string } {
  const match = from.match(/^(.*?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1].trim() || undefined, email: match[2] };
  }
  return { email: from.trim() };
}

// ─── 腾讯云 SES API TC3 签名 ───────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function hmacSha256(key: Buffer, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest();
}

function sign(secretKey: string, service: string, date: string, action: string, payload: string): {
  authorization: string;
  timestamp: number;
} {
  const timestamp = Math.floor(Date.now() / 1000);
  const host = `${service}.tencentcloudapi.com`;
  const canonicalUri = '/';
  const canonicalQueryString = '';
  const canonicalHeaders = `content-type:application/json\nhost:${host}\n`;
  const signedHeaders = 'content-type;host';
  const canonicalRequest = `POST\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${sha256(payload)}`;

  const algorithm = 'TC3-HMAC-SHA256';
  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${sha256(canonicalRequest)}`;

  const secretDate = hmacSha256(Buffer.from(`TC3${secretKey}`), date);
  const secretService = hmacSha256(secretDate, service);
  const secretSigning = hmacSha256(secretService, 'tc3_request');
  const signature = createHmac('sha256', secretSigning).update(stringToSign).digest('hex');

  return {
    authorization: `${algorithm} Credential=AKID/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`.replace('AKID', ''),
    timestamp,
  };
}

// ─── 腾讯云 SES API 客户端 ─────────────────────────────────

function createTencentSesClient(secretId: string, secretKey: string, fromEmail: string): EmailClient {
  const service = 'ses';
  const host = `${service}.tencentcloudapi.com`;

  return {
    emails: {
      async send({ to, subject, html }: EmailSendParams): Promise<void> {
        const date = new Date().toISOString().slice(0, 10);
        const payload = JSON.stringify({
          FromEmailAddress: fromEmail,
          Destination: [to],
          Subject: subject,
          Simple: {
            Html: Buffer.from(html).toString('base64'),
          },
        });

        const { authorization, timestamp } = sign(secretKey, service, date, 'SendEmail', payload);

        const resp = await fetch(`https://${host}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Host': host,
            'X-TC-Action': 'SendEmail',
            'X-TC-Version': '2020-10-02',
            'X-TC-Timestamp': String(timestamp),
            'X-TC-Region': 'ap-guangzhou',
            'Authorization': `TC3-HMAC-SHA256 Credential=${secretId}/${date}/${service}/tc3_request, SignedHeaders=content-type;host, Signature=${authorization.split(', Signature=')[1]}`,
          },
          body: payload,
        });

        const result = await resp.json() as any;
        if (result.Response?.Error) {
          throw new Error(`Tencent SES error: ${result.Response.Error.Code} - ${result.Response.Error.Message}`);
        }
      },
    },
  };
}

// ─── Brevo REST API 客户端 ──────────────────────────────────

function createBrevoClient(apiKey: string): EmailClient {
  return {
    emails: {
      async send({ from, to, subject, html }: EmailSendParams): Promise<void> {
        const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sender: parseFrom(from),
            to: [{ email: to }],
            subject,
            htmlContent: html,
          }),
        });

        if (!resp.ok) {
          const body = await resp.text();
          throw new Error(`Brevo API error ${resp.status}: ${body}`);
        }
      },
    },
  };
}

// ─── 公共导出 ───────────────────────────────────────────────

/** 获取邮件客户端，未配置时返回 null */
export function getResend(): EmailClient | null {
  if (clientInstance !== undefined) return clientInstance;

  // 优先：腾讯云 SES API
  const secretId = process.env.TENCENT_SECRET_ID;
  const secretKey = process.env.TENCENT_SECRET_KEY;
  if (secretId && secretKey) {
    console.log('[Email] Using Tencent Cloud SES API');
    clientInstance = createTencentSesClient(secretId, secretKey, getFromEmail());
    return clientInstance;
  }

  // 备选：Brevo REST API
  const brevoKey = process.env.BREVO_API_KEY;
  if (brevoKey) {
    console.log('[Email] Using Brevo REST API');
    clientInstance = createBrevoClient(brevoKey);
    return clientInstance;
  }

  console.warn('[Email] No email provider configured (TENCENT_SECRET_ID or BREVO_API_KEY), emails will be skipped');
  clientInstance = null;
  return null;
}

/** 获取发件人地址 */
export function getFromEmail(): string {
  return process.env.MAIL_FROM || 'noreply@labanimal.cloud';
}
