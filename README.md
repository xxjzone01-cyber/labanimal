# LabAnimal

**Open-source lab animal facility management — AVMA, Guide, 21 CFR Part 11 compliance engine built-in.**

[![Stars](https://img.shields.io/github/stars/xxjzone01-cyber/labanimal?style=social)](https://github.com/xxjzone01-cyber/labanimal/stargazers)
[![Forks](https://img.shields.io/github/forks/xxjzone01-cyber/labanimal?style=social)](https://github.com/xxjzone01-cyber/labanimal/network/members)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![CI](https://github.com/xxjzone01-cyber/labanimal/actions/workflows/ci.yml/badge.svg)](https://github.com/xxjzone01-cyber/labanimal/actions)

---

## 中文

### 项目介绍

LabAnimal 是一款专为实验动物设施设计的开源管理系统，目标是替代昂贵的商业软件（如 eSirius、Topaz），让任何规模的实验室都能实现数字化合规管理。

系统内置合规引擎，自动校验 AVMA 安乐死方法、NRC 笼位密度、IACUC 3Rs 原则，并提供符合 21 CFR Part 11 的电子签名和防篡改审计日志。

### 核心卖点

| 能力 | 说明 |
|------|------|
| **动态笼位密度** | 基于 NRC Guide 3.1-3.4，按动物体重自动计算最大容量 |
| **AVMA 安乐死验证** | 内置 2020 版方法库，物种+方法不匹配时自动拒绝 |
| **21 CFR Part 11 电子签名** | SHA-256 哈希签名，打印名 + 签名含义 + 时间戳 |
| **防篡改审计日志** | 差分存储 + SHA-256 哈希链，支持冷热分离 |
| **身份弃用 & 关联** | 耳标脱落？退休旧记录、创建新记录、永不合并 |
| **检疫管理** | 兽医清除阻断——检疫期动物无法分配笼位 |
| **繁殖流程** | 配对 → 产仔 → 断奶，自动验证 sire/dam 性别 |
| **15 秒/笼 操作** | 兽医工作台批量健康检查，效率是传统软件的 3 倍 |

### 5 分钟启动

```bash
# 1. 克隆
git clone https://github.com/xxjzone01-cyber/labanimal.git
cd labanimal

# 2. 安装依赖
pnpm install

# 3. 启动数据库
docker compose up -d

# 4. 配置环境变量
cp .env.example .env
# 编辑 .env 设置 DATABASE_URL

# 5. 初始化数据库
pnpm db:migrate
pnpm db:seed

# 6. 启动
pnpm dev
```

访问 http://localhost:5173，演示账号：

| 角色 | 邮箱 | 密码 |
|------|------|------|
| 管理员 | admin@demo.lab | password |
| 兽医 | vet@demo.lab | password |
| 饲养员 | caretaker@demo.lab | password |
| 研究员 | researcher@demo.lab | password |

### 开源版限制（Apache-2.0）

| 维度 | 上限 |
|------|------|
| 动物数量 | 500 只/实验室 |
| 实验室数量 | 1 个/用户 |
| 用户数量 | 10 人/实验室 |

超过上限？升级到 **LabAnimal Pro** 解锁无限容量 + 多实验室聚合 + 自动化合规预警。

### 技术栈

| 层 | 技术 |
|---|------|
| 前端 | React 19 + React Router v6 + Tailwind CSS + Vite 6 |
| 后端 | Hono.js + Prisma 6.19 + PostgreSQL |
| 合规引擎 | 零依赖 TypeScript 库（可独立使用） |
| 构建 | pnpm + Turborepo |
| 容器 | Docker Compose |

### 项目结构

```
labanimal/
├── packages/
│   ├── compliance/     # @labanimal/compliance — 合规引擎（Apache 2.0）
│   │   └── src/
│   │       ├── density/       # 笼位密度计算
│   │       ├── avma/          # 安乐死方法验证
│   │       ├── iacuc/         # 协议校验
│   │       └── audit/         # 差分生成 + 哈希链
│   ├── db/             # @labanimal/db — Prisma schema + 种子数据
│   ├── api/            # @labanimal/api — 19 个 REST API 路由
│   └── app/            # @labanimal/app — 12 个 React 页面
├── e2e/                # Playwright E2E 测试（合规 + 安全 + 工作流）
├── apps/docs/          # VitePress 文档站
└── docker/             # Docker 配置
```

### 种子数据演示场景

`pnpm db:seed` 会创建 5 个 AAALAC 教学场景：

1. **过度拥挤笼位** — 6 只小鼠在同一笼位（含协议豁免）
2. **检疫隔离** — 3 只小鼠 14 天检疫倒计时
3. **身份关联** — M-001 耳标脱落退休 → M-999 继承
4. **单独饲养** — 术后恢复，48 小时限制
5. **AVMA 阻止** — 兔 CO2 安乐死将被拒绝

---

## English

### Introduction

LabAnimal is an open-source lab animal facility management system designed to replace expensive commercial software (eSirius, Topaz, etc.), enabling any lab to achieve digital compliance management at zero cost.

The built-in compliance engine automatically validates AVMA euthanasia methods, NRC cage density limits, and IACUC 3Rs principles. It provides 21 CFR Part 11 compliant electronic signatures and tamper-proof audit logs with SHA-256 hash chains.

### Key Features

| Capability | Description |
|------------|-------------|
| **Dynamic Cage Density** | NRC Guide 3.1-3.4 based, auto-calculates max capacity by animal weight |
| **AVMA Euthanasia Validation** | Built-in 2020 method library, auto-rejects species/method mismatches |
| **21 CFR Part 11 E-Signatures** | SHA-256 hash signatures with printed name, meaning, and timestamp |
| **Tamper-proof Audit Log** | Differential storage + SHA-256 hash chain, hot/cold separation |
| **Identity Link & Retire** | Ear tag fell off? Retire old record, create new, never merge |
| **Quarantine Management** | Vet clearance blocking — quarantined animals cannot be caged |
| **Breeding Workflow** | Pair → Litter → Wean, auto-validates sire/dam sex |
| **15 sec/cage Operation** | Vet Workbench batch health checks, 3x faster than traditional software |

### 5-Minute Quick Start

```bash
# 1. Clone
git clone https://github.com/xxjzone01-cyber/labanimal.git
cd labanimal

# 2. Install dependencies
pnpm install

# 3. Start database
docker compose up -d

# 4. Configure environment
cp .env.example .env
# Edit .env to set DATABASE_URL

# 5. Initialize database
pnpm db:migrate
pnpm db:seed

# 6. Start
pnpm dev
```

Visit http://localhost:5173, demo accounts:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@demo.lab | password |
| Veterinarian | vet@demo.lab | password |
| Caretaker | caretaker@demo.lab | password |
| Researcher | researcher@demo.lab | password |

### Open Source Limits (Apache-2.0)

| Dimension | Limit |
|-----------|-------|
| Animals | 500 per lab |
| Labs | 1 per user |
| Users | 10 per lab |

Exceeding limits? Upgrade to **LabAnimal Pro** for unlimited capacity, multi-lab aggregation, and automated compliance alerts.

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + React Router v6 + Tailwind CSS + Vite 6 |
| Backend | Hono.js + Prisma 6.19 + PostgreSQL |
| Compliance Engine | Zero-dependency TypeScript library (usable standalone) |
| Build | pnpm + Turborepo |
| Containers | Docker Compose |

### Project Structure

```
labanimal/
├── packages/
│   ├── compliance/     # @labanimal/compliance — Compliance engine (Apache 2.0)
│   │   └── src/
│   │       ├── density/       # Cage density calculation
│   │       ├── avma/          # Euthanasia method validation
│   │       ├── iacuc/         # Protocol validation
│   │       └── audit/         # Diff generation + hash chain
│   ├── db/             # @labanimal/db — Prisma schema + seed data
│   ├── api/            # @labanimal/api — 19 REST API route modules
│   └── app/            # @labanimal/app — 12 React pages
├── e2e/                # Playwright E2E tests (compliance + security + workflows)
├── apps/docs/          # VitePress documentation site
└── docker/             # Docker configuration
```

### Seed Data Demo Scenarios

`pnpm db:seed` creates 5 AAALAC teaching scenarios:

1. **Overcrowded Cage** — 6 mice in one cage (with protocol exemption)
2. **Quarantine Isolation** — 3 mice on 14-day quarantine countdown
3. **Identity Link** — M-001 ear tag fell off, retired → M-999 inherits
4. **Single Housing** — Post-surgery recovery, 48-hour limit
5. **AVMA Block** — Rabbit CO2 euthanasia will be rejected

---

## Contributing

Community contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution process and CLA terms.

## Acknowledgements

- [AVMA Guidelines for the Euthanasia of Animals (2020)](https://www.avma.org/resources-tools/avma-policies/avma-guidelines-euthanasia-animals)
- [Guide for the Care and Use of Laboratory Animals (NRC, 8th ed., 2011)](https://nap.nationalcatalogs.org/catalog/12910/guide-for-the-care-and-use-of-laboratory-animals-eighth)
- [PHS Policy on Humane Care and Use of Laboratory Animals](https://grants.nih.gov/grants/olaw/phs-policy.htm)

## License

| Component | License | Reason |
|-----------|---------|--------|
| `@labanimal/compliance` | [Apache 2.0](packages/compliance/LICENSE) | Compliance engine needs wide adoption |
| Main repository | [Apache 2.0](LICENSE) | Permissive license for broad adoption |
| Commercial plugins | Proprietary | SaaS revenue stream |
