import type { Context, Next } from 'hono';
import { verifyToken, type JWTPayload } from '../lib/auth.js';
import { prisma } from '../lib/db.js';

/** 扩展的用户上下文（含 labId） */
export interface AuthContext extends JWTPayload {
  labId?: string;
}

/**
 * JWT 认证中间件 + 多租户 labId 注入
 *
 * 1. 从 Authorization header 提取 JWT
 * 2. 验证 JWT 并提取 userId/email
 * 3. 从 X-Lab-Id header 提取 labId（可选）
 * 4. 验证用户属于该 lab
 * 5. 将 user + labId 注入 context
 */
export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.slice(7);

  let payload: JWTPayload;
  try {
    payload = verifyToken(token);
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  // 提取 labId（从 header）
  const labId = c.req.header('X-Lab-Id');
  const authCtx: AuthContext = { ...payload };

  if (labId) {
    // 验证用户属于该 lab
    const membership = await prisma.userLab.findUnique({
      where: { userId_labId: { userId: payload.userId, labId } },
    });

    if (!membership) {
      return c.json({ error: 'Access denied: not a member of this lab' }, 403);
    }

    authCtx.labId = labId;
  }

  c.set('user', authCtx);
  await next();
}

/**
 * 获取认证用户上下文（含 labId）
 */
export function getUser(c: Context): AuthContext {
  return c.get('user') as AuthContext;
}

/**
 * 获取当前 labId（如果已设置）
 * 路由中可选使用：如果需要 labId 但未提供，返回 400
 */
export function getLabId(c: Context): string {
  const user = getUser(c);
  if (!user.labId) {
    throw new Error('X-Lab-Id header is required for this endpoint');
  }
  return user.labId;
}
