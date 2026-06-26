# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- OpenAPI 3.0 specification (`docs/openapi.yaml`) — 108 endpoints documented
- Deployment guide (`docs/deployment.md`) — manual, Docker, reverse proxy
- Security audit CI job — `pnpm audit` + hardcoded secret scanning
- Billing API integration tests (6 tests)
- Middleware unit tests for `@labanimal/billing` (13 tests)
- Password strength validation (min 8 chars, uppercase + lowercase + number)
- Authentication rate limiting (login: 5/min, register: 3/min)
- JWT secret production safety check — fails startup if `AUTH_SECRET` not set
- PayPal webhook signature verification
- `@labanimal/billing` workspace package — pure business logic, no HTTP dependencies

### Changed
- Billing middleware refactored to use `@labanimal/billing` package
- CI workflow: added `DISABLE_RATE_LIMIT` env var for test-api job

## [0.2.0] — 2026-06-25

### Added
- License signing module (RS256 JWT, report hash signatures)
- License API endpoints: `/api/license/sign`, `/verify`, `/status`, `/renew`
- Verify page — public signature verification by report hash
- Stripe integration — checkout sessions, webhooks, PDF reports with QR codes
- PayPal subscription system — create/activate/cancel, webhook handling
- Billing Wall middleware — non-blocking usage injection, plan limits
- PostgreSQL RLS multi-tenant isolation (18 tables)
- Data migration CLI (`@labanimal/cli`) — SQLite to PostgreSQL
- Offline grace period — 30-day window + 7-day HMAC renewal codes
- Over-limit banner, subscription management, billing dashboard UI
- AAALAC support package, multi-lab billing reports
- Vet workstation, electronic signatures (21 CFR Part 11), audit log hash chain
- Health records with AVMA euthanasia validation
- Breeding module with weaning logic (14-day minimum)
- Protocol 3R validation and status workflow (draft→submitted→approved/rejected→expired)
- Cage density compliance with exemption requests
- Work session tracking (8h timeout, cross-day auto-close)
- Training & certification management with expiry tracking
- Batch session tracking for materials/supplies
- Per-diem billing rate configuration
- Animal identifiers (ear tag, microchip, tattoo) and lineage links
- Environmental enrichment tracking
- labanimal.tech landing page
- VitePress documentation site
- CI pipeline: compliance engine, lint, type check, API tests, frontend build
- 103 API integration tests across 17 test files

### Changed
- Relicensed from AGPL-3.0 to Apache-2.0 (full repository)
- Replaced hardcoded 403 blocks with Billing Wall + signature downgrade
- React 18 → 19
- Prisma 6.19.3

### Fixed
- 7 broken GitHub links in documentation
- CI: compliance build prerequisite, prisma generate, seed step
- CI: API server startup wait loop for tests
- SPA route fallback configuration

## [0.1.0] — 2026-06-24

### Added
- Initial release
- 19 API route modules
- 12 frontend pages
- Compliance engine: AVMA, density limits, 21 CFR Part 11, audit trail
- Open Core limits: 500 animals / 1 lab / 10 users
- Docker configuration (Dockerfile.api, Dockerfile.web, nginx.conf)
- E2E security tests and workflow tests
- Bilingual README (English + Chinese)
- GitHub issue templates (bug, feature, compliance)
- CLA workflow
- CONTRIBUTING.md
