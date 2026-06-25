# Getting Started

Welcome to LabAnimal — an open-source platform for laboratory animal management.

## What is LabAnimal?

LabAnimal is a monorepo-based system designed to help research institutions manage their laboratory animal programs. It covers the full lifecycle: from animal acquisition and cage management to health records, breeding colonies, compliance validation, and billing.

## Key Packages

| Package                 | Description                                                     |
| ----------------------- | --------------------------------------------------------------- |
| `@labanimal/app`        | React + Vite frontend application                               |
| `@labanimal/api`        | Hono-based REST API server                                      |
| `@labanimal/db`         | Prisma ORM schema and database migrations                       |
| `@labanimal/compliance` | Zero-dependency compliance engine (AVMA, IACUC, density, audit) |

## Prerequisites

Before you begin, make sure you have:

- **Node.js** >= 20
- **pnpm** >= 9 (installed globally)
- **PostgreSQL** database (local or remote)

## Next Steps

- [Installation](/guide/installation) — Set up your development environment
- [Quick Start](/guide/quick-start) — Get LabAnimal running in 5 minutes
- [Architecture](/guide/architecture) — Understand the system design
