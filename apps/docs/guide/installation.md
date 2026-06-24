# Installation

## System Requirements

| Requirement | Version |
|-------------|---------|
| Node.js | >= 20 |
| pnpm | >= 9 |
| PostgreSQL | >= 14 |

## Clone the Repository

```bash
git clone https://github.com/anthropics/labanimal.git
cd labanimal
```

## Install Dependencies

LabAnimal uses pnpm workspaces. Install all dependencies from the root:

```bash
pnpm install
```

This installs dependencies for all packages: `app`, `api`, `db`, `compliance`, and `docs`.

## Database Setup

### 1. Create a PostgreSQL Database

```bash
# Using psql
createdb labanimal

# Or using Docker
docker run --name labanimal-db \
  -e POSTGRES_DB=labanimal \
  -e POSTGRES_USER=labanimal \
  -e POSTGRES_PASSWORD=labanimal \
  -p 5432:5432 \
  -d postgres:16
```

### 2. Configure Environment Variables

Create a `.env` file in the `packages/db` directory:

```bash
DATABASE_URL="postgresql://labanimal:labanimal@localhost:5432/labanimal"
```

### 3. Run Migrations

```bash
pnpm db:migrate
```

### 4. Seed the Database (Optional)

```bash
pnpm db:seed
```

## Install the Compliance Package Only

If you only need the compliance engine (e.g., for integration into an existing system):

```bash
npm install @labanimal/compliance
# or
pnpm add @labanimal/compliance
```

The compliance package is a zero-dependency TypeScript library that works in any JavaScript environment.

## Verify Installation

```bash
# Run all tests
pnpm test

# Build all packages
pnpm build

# Start the development server
pnpm dev
```

The frontend should be available at `http://localhost:5173` and the API at `http://localhost:3000`.
