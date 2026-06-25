# Architecture

LabAnimal is structured as a pnpm monorepo with Turborepo for build orchestration.

## Monorepo Structure

```
labanimal/
├── apps/
│   └── docs/          # VitePress documentation site
├── packages/
│   ├── app/           # React frontend (Vite)
│   ├── api/           # REST API server (Hono)
│   ├── db/            # Database layer (Prisma)
│   └── compliance/    # Compliance engine (zero-dependency TypeScript)
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

## Package Responsibilities

### `@labanimal/app` — Frontend

- **Framework**: React 19 + TypeScript
- **Build tool**: Vite
- **Styling**: Tailwind CSS
- **State management**: React Query (TanStack Query)
- Communicates with the API via REST

### `@labanimal/api` — API Server

- **Framework**: Hono (lightweight, edge-ready)
- **Database**: Prisma ORM with PostgreSQL
- **Routes**: Animals, cages, rooms, racks, breedings, health records, medications, death reports, protocols, enrichments, trainings, billing, audit log, electronic signatures, work sessions, batch sessions
- **Auth**: Token-based authentication middleware

### `@labanimal/db` — Database

- **ORM**: Prisma
- **Database**: PostgreSQL
- Contains schema definitions, migrations, and seed scripts
- Shared across API and compliance layers

### `@labanimal/compliance` — Compliance Engine

- **Zero dependencies** — pure TypeScript, works in any JS environment
- **Modules**:
  - `density` — Cage density calculations (NRC Guide 2011)
  - `avma` — Euthanasia method validation (AVMA 2020)
  - `iacuc` — Protocol validation with 3Rs and pain categories
  - `audit` — Diff generation and SHA-256 hash chain for tamper-evident trails

## Data Flow

```
┌──────────────┐     REST     ┌──────────────┐     Prisma     ┌──────────────┐
│   Frontend   │ ──────────── │   API (Hono) │ ────────────── │  PostgreSQL  │
│  (React/Vite)│              │              │                │              │
└──────────────┘              └──────┬───────┘                └──────────────┘
                                     │
                                     │ import
                                     ▼
                              ┌──────────────┐
                              │  Compliance  │
                              │   Engine     │
                              └──────────────┘
```

1. The **frontend** sends REST requests to the **API server**
2. The **API server** reads/writes data via **Prisma** to **PostgreSQL**
3. Business logic calls into the **compliance engine** for validation
4. The **audit module** generates diffs and hashes for tamper-evident trails

## Compliance-First Design

Unlike systems that bolt on compliance as an afterthought, LabAnimal encodes regulatory standards directly into the data model:

- **Cage operations** are validated against density limits before writes
- **Euthanasia records** are checked against AVMA method classifications
- **Protocol submissions** are validated against IACUC requirements and the 3Rs
- **All mutations** generate audit trail entries with SHA-256 hash chains

## Supported Species

The compliance engine currently supports:

- Mouse
- Rat
- Hamster
- Guinea pig
- Rabbit

Additional species can be added by extending the density standards and AVMA method tables in `@labanimal/compliance`.
