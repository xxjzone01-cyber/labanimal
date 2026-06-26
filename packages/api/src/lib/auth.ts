import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const DEFAULT_SECRET = 'dev-secret-change-in-production';
const SECRET = process.env.AUTH_SECRET || DEFAULT_SECRET;
const EXPIRES_IN = '7d';

// 生产环境强制要求设置 AUTH_SECRET
if (
  process.env.NODE_ENV === 'production' &&
  (!process.env.AUTH_SECRET || process.env.AUTH_SECRET === DEFAULT_SECRET)
) {
  throw new Error(
    'FATAL: AUTH_SECRET environment variable must be set in production. ' +
      'Generate one with: openssl rand -hex 32',
  );
}

export interface JWTPayload {
  userId: string;
  email: string;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, SECRET) as JWTPayload;
}
