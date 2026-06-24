import { describe, test, expect, beforeAll } from 'vitest';
import { api, loginAsAdmin, getLabId } from './helper';

describe('T4. 协议模块', () => {
  beforeAll(async () => {
    await loginAsAdmin();
  });

  test('T4.1 创建协议', async () => {
    const res = await api('POST', '/protocols', {
      labId: getLabId(),
      title: `Test Protocol ${Date.now()}`,
      piName: 'Dr. Smith',
      painCategory: 'B',
    });
    expect(res.status).toBe(201);
    expect(res.data.id).toBeTruthy();
    expect(res.data.status).toBe('draft');
  });

  test('T4.2 创建协议缺必填字段', async () => {
    const res = await api('POST', '/protocols', {
      labId: getLabId(),
      // 缺 title 和 piName
    });
    expect(res.status).toBe(400);
  });

  test('T4.3 列出协议', async () => {
    const res = await api('GET', `/protocols?labId=${getLabId()}`);
    expect(res.status).toBe(200);
    expect(res.data).toBeInstanceOf(Array);
  });

  test('T4.4 协议状态转换 draft→submitted', async () => {
    const create = await api('POST', '/protocols', {
      labId: getLabId(),
      title: `Status Test ${Date.now()}`,
      piName: 'Dr. Jones',
    });
    const id = create.data.id;

    const res = await api('PUT', `/protocols/${id}`, { status: 'submitted' });
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('submitted');
    expect(res.data.submittedAt).toBeTruthy();
  });

  test('T4.5 无效状态转换应拒绝', async () => {
    const create = await api('POST', '/protocols', {
      labId: getLabId(),
      title: `Invalid Transition ${Date.now()}`,
      piName: 'Dr. Fail',
    });
    const id = create.data.id;

    // draft → approved 是无效的
    const res = await api('PUT', `/protocols/${id}`, { status: 'approved' });
    expect(res.status).toBe(400);
    expect(res.data.error).toMatch(/invalid status transition/i);
  });

  test('T4.6 验证协议（3R 合规）', async () => {
    const create = await api('POST', '/protocols', {
      labId: getLabId(),
      title: `Validate Test ${Date.now()}`,
      piName: 'Dr. Valid',
      threeRsReplacement: 'Used in silico alternatives',
      hasStatisticalJustification: true,
      usesAnalgesics: true,
      hasHumaneEndpoints: true,
    });
    const id = create.data.id;

    const res = await api('POST', `/protocols/${id}/validate`);
    expect(res.status).toBe(200);
    expect(res.data).toBeDefined();
    // 应返回合规结果
    expect(res.data.valid).toBeDefined();
  });

  test('T4.7 删除草稿协议', async () => {
    const create = await api('POST', '/protocols', {
      labId: getLabId(),
      title: `Delete Test ${Date.now()}`,
      piName: 'Dr. Del',
    });
    const id = create.data.id;

    const res = await api('DELETE', `/protocols/${id}`);
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
  });
});
