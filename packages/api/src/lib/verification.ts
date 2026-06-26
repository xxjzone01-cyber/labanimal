import { Resend } from 'resend';

// 验证码存储（内存，5 分钟过期）
const codes = new Map<string, { code: string; expiresAt: number }>();

const CODE_TTL_MS = 5 * 60 * 1000; // 5 分钟
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = process.env.VERIFICATION_FROM || 'LabAnimal <onboarding@resend.dev>';

function getResend() {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not configured');
  }
  return new Resend(RESEND_API_KEY);
}

/** 生成 6 位数字验证码 */
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/** 发送验证码到指定邮箱 */
export async function sendVerificationCode(email: string): Promise<void> {
  const code = generateCode();
  codes.set(email.toLowerCase(), { code, expiresAt: Date.now() + CODE_TTL_MS });

  const resend = getResend();
  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Your LabAnimal Verification Code',
    html: `
      <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb;">LabAnimal Email Verification</h2>
        <p>Your verification code is:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1e40af; background: #eff6ff; padding: 16px; text-align: center; border-radius: 8px; margin: 16px 0;">
          ${code}
        </div>
        <p style="color: #666; font-size: 14px;">This code expires in 5 minutes. If you didn't request this, please ignore this email.</p>
      </div>
    `,
  });
}

/** 验证验证码，成功后删除 */
export function verifyCode(email: string, code: string): boolean {
  const key = email.toLowerCase();
  const entry = codes.get(key);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    codes.delete(key);
    return false;
  }
  if (entry.code !== code) return false;
  codes.delete(key);
  return true;
}
