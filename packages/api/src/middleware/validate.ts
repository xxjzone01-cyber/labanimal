import { HTTPException } from 'hono/http-exception';
import type { ZodSchema, ZodError } from 'zod';

/**
 * 用 Zod 校验数据，失败时抛出 HTTPException(400)。
 * 路由中直接调用：const body = parseBody(schema, await c.req.json());
 */
export function parseBody<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = formatZodError(result.error);
    throw new HTTPException(400, { message: errors.join('; ') });
  }
  return result.data;
}

/**
 * 用 Zod 校验查询参数。
 */
export function parseQuery<T>(schema: ZodSchema<T>, query: Record<string, string | undefined>): T {
  const result = schema.safeParse(query);
  if (!result.success) {
    const errors = formatZodError(result.error);
    throw new HTTPException(400, { message: errors.join('; ') });
  }
  return result.data;
}

function formatZodError(error: ZodError): string[] {
  return error.issues.map((i) => {
    const path = i.path.length > 0 ? `${i.path.join('.')}: ` : '';
    return `${path}${i.message}`;
  });
}
