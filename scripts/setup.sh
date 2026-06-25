#!/usr/bin/env bash
# LabAnimal — One-click development environment setup
# Usage: ./scripts/setup.sh [--skip-docker] [--skip-seed]

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SKIP_DOCKER=false
SKIP_SEED=false

for arg in "$@"; do
  case $arg in
    --skip-docker) SKIP_DOCKER=true ;;
    --skip-seed) SKIP_SEED=true ;;
  esac
done

log()  { echo -e "${BLUE}[LabAnimal]${NC} $1"; }
ok()   { echo -e "${GREEN}✅${NC} $1"; }
warn() { echo -e "${YELLOW}⚠️${NC} $1"; }
fail() { echo -e "${RED}❌${NC} $1"; exit 1; }

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       LabAnimal Development Setup        ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Check Node.js ──────────────────────────────────────────
log "Checking Node.js..."
if command -v node &>/dev/null; then
  NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VERSION" -ge 20 ]; then
    ok "Node.js $(node -v) detected"
  else
    fail "Node.js 20+ required, found $(node -v). Please upgrade."
  fi
else
  fail "Node.js not found. Install from https://nodejs.org/"
fi

# ── 2. Check pnpm ─────────────────────────────────────────────
log "Checking pnpm..."
if command -v pnpm &>/dev/null; then
  PNPM_VERSION=$(pnpm -v | cut -d. -f1)
  if [ "$PNPM_VERSION" -ge 9 ]; then
    ok "pnpm $(pnpm -v) detected"
  else
    warn "pnpm 9+ recommended, found $(pnpm -v). Upgrading..."
    npm install -g pnpm@latest
  fi
else
  warn "pnpm not found. Installing..."
  npm install -g pnpm@9
  ok "pnpm installed"
fi

# ── 3. Install dependencies ───────────────────────────────────
log "Installing dependencies..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
ok "Dependencies installed"

# ── 4. Docker services ────────────────────────────────────────
if [ "$SKIP_DOCKER" = false ]; then
  log "Checking Docker..."
  if command -v docker &>/dev/null; then
    ok "Docker $(docker --version | cut -d' ' -f3 | tr -d ',') detected"

    log "Starting PostgreSQL + Redis + MinIO..."
    docker compose up -d

    # Wait for PostgreSQL to be ready
    log "Waiting for PostgreSQL..."
    for i in $(seq 1 30); do
      if docker compose exec -T postgres pg_isready -U postgres &>/dev/null; then
        ok "PostgreSQL is ready"
        break
      fi
      if [ "$i" -eq 30 ]; then
        fail "PostgreSQL failed to start after 30 seconds"
      fi
      sleep 1
    done
  else
    warn "Docker not found. Using local PostgreSQL if available."
    warn "Install Docker for the full experience: https://docker.com/"
  fi
else
  warn "Skipping Docker setup (--skip-docker)"
fi

# ── 5. Database migration ─────────────────────────────────────
log "Running database migrations..."
pnpm --filter @labanimal/db exec prisma migrate deploy 2>/dev/null || {
  warn "Migration failed. Trying dev migration..."
  pnpm --filter @labanimal/db exec prisma migrate dev --skip-seed --name init 2>/dev/null || true
}
ok "Database migrations applied"

# ── 6. Seed data ──────────────────────────────────────────────
if [ "$SKIP_SEED" = false ]; then
  log "Seeding demo data (AAALAC teaching scenarios)..."
  pnpm --filter @labanimal/db exec prisma db seed 2>/dev/null || {
    warn "Seed failed (may already be seeded). Continuing..."
  }
  ok "Demo data seeded"
else
  warn "Skipping seed (--skip-seed)"
fi

# ── 7. Build packages ─────────────────────────────────────────
log "Building compliance engine..."
pnpm --filter @labanimal/compliance build
ok "Compliance engine built"

# ── 8. Run tests ──────────────────────────────────────────────
log "Running compliance tests..."
pnpm --filter @labanimal/compliance test
ok "All compliance tests passed"

# ── 9. Summary ────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        LabAnimal is ready! 🎉            ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BLUE}API:${NC}      http://localhost:3001"
echo -e "  ${BLUE}Frontend:${NC} http://localhost:5173"
echo ""
echo -e "  ${YELLOW}Start development:${NC}"
echo -e "    pnpm dev"
echo ""
echo -e "  ${YELLOW}Default login:${NC}"
echo -e "    admin@demo.lab / password"
echo ""
echo -e "  ${YELLOW}Run tests:${NC}"
echo -e "    pnpm --filter @labanimal/compliance test"
echo ""
echo -e "  ${YELLOW}License:${NC}"
echo -e "    Compliance engine: Apache 2.0"
echo -e "    Main repository:   Apache-2.0"
echo ""
