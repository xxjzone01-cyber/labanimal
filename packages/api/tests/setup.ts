/**
 * Vitest 全局 setup — 加载 .env
 *
 * Prisma 7 需要 DATABASE_URL 在进程环境中。
 * 测试通过 HTTP 调用运行中的 API 服务器，
 * 但部分测试直接创建 PrismaClient 需要此变量。
 */
import dotenv from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../../.env') });

// 测试环境跳过邮箱验证码
process.env.SKIP_EMAIL_VERIFICATION = 'true';
