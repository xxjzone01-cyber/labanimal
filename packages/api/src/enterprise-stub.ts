/**
 * 开源版 Enterprise Stub 路由
 *
 * 当 @labanimal/enterprise（闭源包）不可用时，
 * 所有端点返回 501 Not Implemented。
 */

import { Hono } from 'hono';

const MSG = 'Enterprise features not available in open-source edition. Install @labanimal/enterprise for full functionality.';

function createEnterpriseStub(): Hono {
  const routes = new Hono();

  routes.post('/offline-licenses', (c) => c.json({ error: MSG }, 501));
  routes.get('/offline-licenses', (c) => c.json({ error: MSG }, 501));
  routes.delete('/offline-licenses/:id', (c) => c.json({ error: MSG }, 501));

  return routes;
}

function createAaaLacStub(): Hono {
  const routes = new Hono();

  routes.get('/materials', (c) => c.json({ error: MSG }, 501));
  routes.get('/checklist', (c) => c.json({ error: MSG }, 501));

  return routes;
}

export function createEnterpriseStubRoutes() {
  return {
    enterprise: createEnterpriseStub(),
    aaalac: createAaaLacStub(),
  };
}
