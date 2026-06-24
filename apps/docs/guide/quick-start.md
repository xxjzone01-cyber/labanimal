# Quick Start

Get LabAnimal up and running in 5 minutes.

## Step 1: Install Dependencies

```bash
git clone https://github.com/anthropics/labanimal.git
cd labanimal
pnpm install
```

## Step 2: Set Up the Database

Make sure PostgreSQL is running, then:

```bash
# Create the database
createdb labanimal

# Set the connection string
export DATABASE_URL="postgresql://localhost:5432/labanimal"

# Run migrations and seed
pnpm db:migrate
pnpm db:seed
```

## Step 3: Start the Development Server

```bash
pnpm dev
```

This starts both the API server and the frontend application using Turbo.

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| API | http://localhost:3000 |

## Step 4: Explore the Compliance Engine

You can try the compliance engine directly in a Node.js script:

```typescript
import { calculateMaxDensity, validateMethod, validateProtocol } from '@labanimal/compliance';

// Check cage density
const density = calculateMaxDensity({
  species: 'mouse',
  weightGrams: 25,
  currentCount: 3,
  addingCount: 1,
});
console.log('Density check:', density);

// Validate euthanasia method
const euthanasia = validateMethod({
  species: 'mouse',
  methodId: 'cervical_dislocation',
  weightGrams: 500,
  performerCertified: true,
});
console.log('Euthanasia check:', euthanasia);

// Validate IACUC protocol
const protocol = validateProtocol({
  title: 'Behavioral Study',
  piName: 'Dr. Smith',
  status: 'draft',
  species: ['mouse'],
  animalCounts: { mouse: 20 },
  alternativesConsidered: true,
  hasStatisticalJustification: true,
  painCategory: 'D',
  usesAnalgesics: true,
  hasHumaneEndpoints: true,
  personnelTrained: true,
  involvesSurgery: false,
  survivalSurgery: false,
});
console.log('Protocol valid:', protocol.valid);
```

## Step 5: Explore the API

The API exposes RESTful endpoints. Here are a few examples:

```bash
# List animals
curl http://localhost:3000/api/animals

# List cages
curl http://localhost:3000/api/cages

# Check compliance
curl -X POST http://localhost:3000/api/compliance/density \
  -H "Content-Type: application/json" \
  -d '{"species":"mouse","weightGrams":25,"currentCount":3,"addingCount":1}'
```

## Next Steps

- Read the [Architecture](/guide/architecture) overview to understand the system design
- Explore the [Compliance](/compliance/) documentation for regulatory details
- Check the [API Reference](/api/) for the full OpenAPI spec
