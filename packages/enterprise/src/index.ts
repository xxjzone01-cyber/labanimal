/**
 * @labanimal/enterprise — 企业版增值功能
 *
 * 可独立发布为私有 npm 包。
 * 包含：离线授权码管理、AAALAC 资料包。
 */

export { createEnterpriseRoutes } from './routes/enterprise.js';
export { createAaaLacRoutes } from './routes/aaalac.js';
export type { EnterpriseDeps, PrismaClient, UserInfo } from './types.js';
