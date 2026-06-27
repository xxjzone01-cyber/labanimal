/**
 * 企业版路由 — 离线授权码 CRUD
 */

import { Hono } from 'hono';
import type { EnterpriseDeps } from '../types.js';

export function createEnterpriseRoutes(deps: EnterpriseDeps): Hono {
  const { prisma, getUser } = deps;
  const routes = new Hono();

  // POST /offline-licenses — 创建离线授权码
  routes.post('/offline-licenses', async (c) => {
    const user = getUser(c);
    const body = await c.req.json();
    const { labId, expiresAt, maxDevices, notes } = body;

    if (!labId) {
      return c.json({ error: 'labId is required' }, 400);
    }

    // 生成授权码
    const code = `LA-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    const license = await (prisma as any).offlineLicense.create({
      data: {
        code,
        labId,
        createdBy: user.userId,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        maxDevices: maxDevices || 10,
        notes: notes || null,
      },
    });

    return c.json(license, 201);
  });

  // GET /offline-licenses — 列出离线授权码
  routes.get('/offline-licenses', async (c) => {
    const labId = c.req.query('labId');
    if (!labId) {
      return c.json({ error: 'labId query parameter is required' }, 400);
    }

    const licenses = await (prisma as any).offlineLicense.findMany({
      where: { labId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return c.json(licenses);
  });

  // DELETE /offline-licenses/:id — 撤销离线授权码
  routes.delete('/offline-licenses/:id', async (c) => {
    const id = c.req.param('id');

    await (prisma as any).offlineLicense.delete({
      where: { id },
    });

    return c.json({ success: true });
  });

  return routes;
}
