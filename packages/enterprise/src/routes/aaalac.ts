/**
 * AAALAC 资料包管理路由
 */

import { Hono } from 'hono';
import type { EnterpriseDeps } from '../types.js';

export function createAaaLacRoutes(_deps: EnterpriseDeps): Hono {
  const routes = new Hono();

  // GET /aaalac/materials — 获取 AAALAC 资料包列表
  routes.get('/materials', async (c) => {
    // 企业版 AAALAC 资料包（静态数据，未来可扩展为数据库存储）
    const materials = [
      {
        id: 'checklist-2024',
        title: 'AAALAC 认证审查清单 2024',
        description: '基于最新 AAALAC 标准的完整审查清单',
        category: 'checklist',
        format: 'PDF',
      },
      {
        id: 'iacuc-template',
        title: 'IACUC 协议模板',
        description: '符合 AAALAC 要求的 IACUC 审查协议模板',
        category: 'template',
        format: 'DOCX',
      },
      {
        id: 'training-curriculum',
        title: '人员培训课程大纲',
        description: 'AAALAC 要求的动物护理人员培训课程框架',
        category: 'training',
        format: 'PDF',
      },
      {
        id: 'facility-inspection',
        title: '设施自查表',
        description: 'AAALAC 现场审查前的设施自查清单',
        category: 'checklist',
        format: 'XLSX',
      },
      {
        id: 'sop-library',
        title: 'SOP 模板库',
        description: '20+ 标准操作程序模板，涵盖日常管理到应急处理',
        category: 'template',
        format: 'ZIP',
      },
    ];

    return c.json(materials);
  });

  // GET /aaalac/checklist — 获取 AAALAC 自查清单
  routes.get('/checklist', async (c) => {
    const checklist = {
      title: 'AAALAC 认证自查清单',
      sections: [
        {
          name: 'IACUC 程序',
          items: [
            { id: 1, question: '是否有书面的 ACUP？', critical: true },
            { id: 2, question: 'IACUC 组成是否合规？', critical: true },
            { id: 3, question: '是否定期审查协议？', critical: true },
            { id: 4, question: '是否有投诉处理程序？', critical: false },
            { id: 5, question: '是否进行设施巡查？', critical: true },
          ],
        },
        {
          name: '兽医护理',
          items: [
            { id: 6, question: '是否有 24/7 兽医护理？', critical: true },
            { id: 7, question: '是否有检疫程序？', critical: true },
            { id: 8, question: '安乐死方法是否符合 AVMA？', critical: true },
            { id: 9, question: '是否有疼痛管理 SOP？', critical: true },
            { id: 10, question: '健康记录是否完整？', critical: false },
          ],
        },
        {
          name: '设施管理',
          items: [
            { id: 11, question: '环境参数是否监测？', critical: true },
            { id: 12, question: '是否有害虫控制计划？', critical: false },
            { id: 13, question: '废物处理是否合规？', critical: true },
            { id: 14, question: '是否有应急计划？', critical: true },
            { id: 15, question: '人员培训记录是否完整？', critical: false },
          ],
        },
      ],
    };

    return c.json(checklist);
  });

  return routes;
}
