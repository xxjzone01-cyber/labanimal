import type { Context, Next } from 'hono';
import { verifyToken, type JWTPayload } from '../lib/auth.js';

/**
 * JWT authentication middleware.
 * Extracts token from Authorization header and attaches user to context.
 */
export async function authMiddleware(c: Context, next: Next): Promise<void> {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyToken(token);
    c.set('user', payload);
    await next();
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
}

/**
 * Get authenticated user from context.
 */
export function getUser(c: Context): JWTPayload {
  return c.get('user') as JWTPayload;
}
