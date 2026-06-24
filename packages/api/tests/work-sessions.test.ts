import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { api, loginAsAdmin, getLabId } from './helper';

describe('T11. 工作会话模块', () => {
  beforeAll(async () => {
    await loginAsAdmin();
  });

  // 清理：结束所有活跃会话
  afterAll(async () => {
    const active = await api('GET', `/work-sessions/active?labId=${getLabId()}`);
    if (active.status === 200 && active.data.id) {
      await api('PUT', `/work-sessions/${active.data.id}/end`);
    }
  });

  test('T11.1 开始工作会话', async () => {
    // 先结束可能存在的活跃会话
    const active = await api('GET', `/work-sessions/active?labId=${getLabId()}`);
    if (active.status === 200 && active.data.id) {
      await api('PUT', `/work-sessions/${active.data.id}/end`);
    }

    const res = await api('POST', '/work-sessions', { labId: getLabId() });
    expect(res.status).toBe(201);
    expect(res.data.id).toBeTruthy();
    expect(res.data.endedAt).toBeNull();
    expect(res.data.timeoutAt).toBeTruthy();
  });

  test('T11.2 重复开始应返回 409', async () => {
    // 已有活跃会话，再开一个
    const res = await api('POST', '/work-sessions', { labId: getLabId() });
    expect(res.status).toBe(409);
    expect(res.data.error).toMatch(/active session/i);
  });

  test('T11.3 获取活跃会话', async () => {
    const res = await api('GET', `/work-sessions/active?labId=${getLabId()}`);
    expect(res.status).toBe(200);
    expect(res.data.id).toBeTruthy();
    expect(res.data.endedAt).toBeNull();
  });

  test('T11.4 结束工作会话', async () => {
    const active = await api('GET', `/work-sessions/active?labId=${getLabId()}`);
    expect(active.status).toBe(200);
    const sessionId = active.data.id;

    const res = await api('PUT', `/work-sessions/${sessionId}/end`);
    expect(res.status).toBe(200);
    expect(res.data.endedAt).toBeTruthy();
  });

  test('T11.5 结束已结束的会话应返回 400', async () => {
    // 开一个新会话然后结束
    const create = await api('POST', '/work-sessions', { labId: getLabId() });
    const sessionId = create.data.id;
    await api('PUT', `/work-sessions/${sessionId}/end`);

    // 再次结束
    const res = await api('PUT', `/work-sessions/${sessionId}/end`);
    expect(res.status).toBe(400);
    expect(res.data.error).toMatch(/already ended/i);
  });

  test('T11.6 列出工作会话', async () => {
    const res = await api('GET', `/work-sessions?labId=${getLabId()}`);
    expect(res.status).toBe(200);
    expect(res.data.items).toBeInstanceOf(Array);
  });
});
