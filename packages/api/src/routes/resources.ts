/**
 * 资源门控 API
 *
 * POST /api/resources/gate — 接收邮箱/姓名/机构/资源标识，通过 Resend 发送完整内容邮件
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { getResend, getFromEmail } from '../lib/email/resend.js';

const gateSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().max(100).optional().default(''),
  institution: z.string().max(200).optional().default(''),
  resource: z.enum(['aaalac-50-questions', 'security-whitepaper']),
});

// 简易内存速率限制（email 级）
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT = 3;
const RATE_WINDOW = 24 * 60 * 60 * 1000; // 24 小时

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(key) || [];
  const recent = timestamps.filter((t) => now - t < RATE_WINDOW);
  if (recent.length >= RATE_LIMIT) return false;
  recent.push(now);
  rateLimitMap.set(key, recent);
  return true;
}

export const resources = new Hono();

// AAALAC 50 题完整内容（精简版，实际可更详细）
const AAALAC_50_QUESTIONS = `
<h2>AAALAC 认证 50 个关键问题 — 完整指南</h2>
<p>以下是完整的 50 个问题清单，涵盖 AAALAC 认证审查的所有核心领域：</p>

<h3>一、IACUC 程序与管理（1-10）</h3>
<ol>
<li>设施是否有书面的动物护理和使用计划（ACUP）？</li>
<li>IACUC 委员会的组成是否符合要求？（至少包括一名兽医、一名非科学家成员、一名外部成员）</li>
<li>IACUC 是否定期审查所有进行中的动物使用协议？</li>
<li>协议变更是否有正式的修改和审批流程？</li>
<li>IACUC 是否有终止动物使用的权限和程序？</li>
<li>是否有书面的人员培训计划和记录？</li>
<li>IACUC 会议记录和审查决定是否完整保存？</li>
<li>是否有书面的投诉和关注处理程序？</li>
<li>IACUC 是否进行设施巡查（至少每 6 个月一次）？</li>
<li>是否有书面的紧急事件应急计划？</li>
</ol>

<h3>二、兽医护理（11-20）</h3>
<ol start="11">
<li>兽医护理计划是否包括预防医学和紧急护理？</li>
<li>是否有驻场或合约兽医提供 24/7 紧急护理？</li>
<li>新动物是否有检疫程序？</li>
<li>是否有疾病监测和报告程序？</li>
<li>动物健康记录是否完整且易于访问？</li>
<li>安乐死方法是否符合 AVMA 标准？</li>
<li>是否有术后护理和疼痛管理 SOP？</li>
<li>药物存储和管理是否符合规范？</li>
<li>是否有寄生虫控制计划？</li>
<li>兽医是否参与 IACUC 协议审查？</li>
</ol>

<h3>三、动物福利与饲养管理（21-30）</h3>
<ol start="21">
<li>动物饲养环境是否符合物种特异性要求？</li>
<li>笼位面积是否符合 NRC 指南标准？</li>
<li>温度、湿度、光照周期是否有监测记录？</li>
<li>通风换气次数是否符合标准？</li>
<li>是否有环境富化计划？</li>
<li>饲料和饮水质量是否有检测记录？</li>
<li>笼位清洁频率是否有 SOP？</li>
<li>是否有社会性动物的群养安排？</li>
<li>运输过程中的动物福利是否有保障？</li>
<li>是否有濒死动物的人道终点标准？</li>
</ol>

<h3>四、设施管理与安全（31-40）</h3>
<ol start="31">
<li>设施是否有完善的安全管理计划？</li>
<li>危险化学品和生物材料是否有专人管理？</li>
<li>废物处理是否符合法规要求？</li>
<li>是否有害虫控制计划？</li>
<li>设施维护记录是否完整？</li>
<li>是否有应急电源和供水备份？</li>
<li>人员防护装备（PPE）是否充足？</li>
<li>是否有实验室安全培训计划？</li>
<li>设施是否有访问控制措施？</li>
<li>是否有事故报告和调查程序？</li>
</ol>

<h3>五、记录与合规（41-50）</h3>
<ol start="41">
<li>所有动物使用记录是否保存至少 3 年？</li>
<li>是否有完整的审计追踪系统？</li>
<li>培训记录是否与人员档案关联？</li>
<li>是否有标准化的 SOP 管理系统？</li>
<li>协议审批文件是否包含所有必需签名？</li>
<li>是否有定期的内部审核程序？</li>
<li>是否遵守相关法规（如动物福利法）？</li>
<li>是否有数据备份和灾难恢复计划？</li>
<li>是否配合 AAALAC 现场审查？</li>
<li>是否有持续改进计划和质量管理体系？</li>
</ol>

<h3>LabAnimal 合规对照</h3>
<p>LabAnimal 系统的每个功能模块都直接映射上述审查要点，帮助您：</p>
<ul>
<li><strong>自动合规检查</strong>：AVMA 安乐死验证、NRC 密度计算</li>
<li><strong>完整记录管理</strong>：动物档案、健康记录、协议审批、人员培训</li>
<li><strong>电子签名</strong>：符合 21 CFR Part 11 的电子签名系统</li>
<li><strong>审计追踪</strong>：SHA-256 哈希链确保记录不可篡改</li>
</ul>
<p>了解更多：<a href="https://labanimal.tech">labanimal.tech</a></p>
`;

const SECURITY_WHITEPAPER = `
<h2>LabAnimal 安全架构白皮书 — 完整版</h2>
<p>以下是完整的安全白皮书内容，涵盖所有 10 章：</p>

<h3>第六章：基础设施安全</h3>
<p>LabAnimal 的前端部署在 Vercel（全球 CDN + DDoS 防护 + WAF），API 服务器使用防火墙和安全组限制访问。所有数据传输使用 TLS 1.3 加密，HSTS 强制 HTTPS。数据库使用 SSL 加密连接。</p>

<h3>第七章：合规标准映射</h3>
<table style="border-collapse:collapse;width:100%">
<tr style="background:#f3f4f6"><th style="padding:8px;border:1px solid #e5e7eb">合规标准</th><th style="padding:8px;border:1px solid #e5e7eb">LabAnimal 功能</th><th style="padding:8px;border:1px solid #e5e7eb">实现方式</th></tr>
<tr><td style="padding:8px;border:1px solid #e5e7eb">21 CFR Part 11</td><td style="padding:8px;border:1px solid #e5e7eb">电子签名</td><td style="padding:8px;border:1px solid #e5e7eb">SHA-256 + RSA</td></tr>
<tr><td style="padding:8px;border:1px solid #e5e7eb">AVMA 2020</td><td style="padding:8px;border:1px solid #e5e7eb">安乐死验证</td><td style="padding:8px;border:1px solid #e5e7eb">物种+方法匹配</td></tr>
<tr><td style="padding:8px;border:1px solid #e5e7eb">NRC 2011</td><td style="padding:8px;border:1px solid #e5e7eb">密度计算</td><td style="padding:8px;border:1px solid #e5e7eb">动态公式</td></tr>
<tr><td style="padding:8px;border:1px solid #e5e7eb">AAALAC</td><td style="padding:8px;border:1px solid #e5e7eb">审计准备</td><td style="padding:8px;border:1px solid #e5e7eb">完整审计追踪</td></tr>
<tr><td style="padding:8px;border:1px solid #e5e7eb">GDPR</td><td style="padding:8px;border:1px solid #e5e7eb">数据保护</td><td style="padding:8px;border:1px solid #e5e7eb">加密+访问控制</td></tr>
</table>

<h3>第八章：安全运维实践</h3>
<ul>
<li>CI/CD 安全扫描：每次代码提交触发依赖审计和密钥检测</li>
<li>密钥管理：所有敏感配置使用环境变量</li>
<li>日志监控：记录所有安全相关事件</li>
<li>备份策略：pg_dump + gzip + 腾讯云 COS 每日自动备份</li>
</ul>

<h3>第九章：漏洞响应流程</h3>
<ol>
<li>接收：security@labanimal.tech 或 GitHub Security Advisories</li>
<li>确认：48 小时内确认并评估</li>
<li>分类：按 CVSS 评分分类</li>
<li>修复：高危 7 天，中危 30 天</li>
<li>发布：安全补丁 + 用户通知</li>
<li>公开：修复后 90 天公开详情</li>
</ol>

<h3>第十章：安全检查清单</h3>
<ul>
<li>✅ 传输加密：TLS 1.3 + HSTS</li>
<li>✅ 密码安全：bcrypt (cost 12) + 强度策略</li>
<li>✅ 多租户隔离：PostgreSQL RLS + API 层强制</li>
<li>✅ 审计追踪：SHA-256 哈希链</li>
<li>✅ 输入验证：Zod schema + 参数化查询</li>
<li>✅ 速率限制：登录/注册/API 端点</li>
<li>✅ 开源审计：Apache-2.0 公开代码</li>
</ul>
`;

const resourceContent: Record<string, { subject: string; html: string }> = {
  'aaalac-50-questions': {
    subject: 'AAALAC 认证 50 个关键问题 — 完整指南',
    html: AAALAC_50_QUESTIONS,
  },
  'security-whitepaper': {
    subject: 'LabAnimal 安全架构白皮书 — 完整版',
    html: SECURITY_WHITEPAPER,
  },
};

resources.post('/gate', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const parsed = gateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const { email, name, institution, resource } = parsed.data;

  if (!checkRateLimit(email)) {
    return c.json({ error: 'Too many requests. Please try again tomorrow.' }, 429);
  }

  const content = resourceContent[resource];
  if (!content) {
    return c.json({ error: 'Unknown resource' }, 400);
  }

  const resend = getResend();

  if (!resend) {
    console.log('[Resources] Resend not configured, logging gate submission:', { email, name, institution, resource });
    return c.json({ success: true, message: 'Submission recorded' });
  }

  try {
    // 发送完整内容邮件给用户
    await resend.emails.send({
      from: getFromEmail(),
      to: email,
      subject: content.subject,
      html: `
        <div style="font-family:Inter,system-ui,sans-serif;max-width:700px;margin:0 auto;padding:20px">
          <div style="text-align:center;margin-bottom:24px">
            <h1 style="color:#1e3a5f;margin:0">LabAnimal</h1>
            <p style="color:#6b7280;margin-top:4px">实验动物合规管理系统</p>
          </div>
          ${name ? `<p>您好 ${name}，</p>` : '<p>您好，</p>'}
          <p>感谢您的关注！以下是您请求的完整内容：</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">
          ${content.html}
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">
          <p style="color:#6b7280;font-size:12px">
            此邮件由 LabAnimal 系统自动发送。如需帮助，请联系 contact@labanimal.tech
          </p>
        </div>
      `,
    });

    // 通知内部团队
    void (async () => {
      try {
        await resend.emails.send({
          from: getFromEmail(),
          to: 'contact@labanimal.tech',
          subject: `[资源下载] ${content.subject} — ${email}`,
          html: `
            <p><strong>资源：</strong>${content.subject}</p>
            <p><strong>邮箱：</strong>${email}</p>
            <p><strong>姓名：</strong>${name || '未填写'}</p>
            <p><strong>机构：</strong>${institution || '未填写'}</p>
            <p><strong>时间：</strong>${new Date().toISOString()}</p>
          `,
        });
      } catch {}
    })();

    return c.json({ success: true, message: 'Content sent to your email' });
  } catch (err) {
    console.error('[Resources] Failed to send email:', err);
    return c.json({ error: 'Failed to send email. Please try again later.' }, 500);
  }
});
