# @labanimal/compliance — Cross-Platform Usage

Zero-dependency compliance engine for laboratory animal management. Works everywhere JavaScript runs.

## Node.js / Bun / Deno

```typescript
import { calculateMaxDensity, AVMA_METHODS, validateProtocol, sha256 } from '@labanimal/compliance';

// Cage density calculation
const result = calculateMaxDensity({
  species: 'mouse',
  weightGrams: 22,
  housingStatus: 'group',
  guideStandard: 4,
  protocolApprovedDensity: null,
});
// { allowed: true, maxCount: 4, reason: 'Guide Table 3.1' }

// AVMA euthanasia validation
const avma = AVMA_METHODS.validate('rabbit', 'co2', { weightGrams: 3000 });
// { category: 'unacceptable', issues: ['CO2 is not acceptable for rabbits (AVMA 2020)'] }

// SHA-256 hashing
const hash = await sha256('data to hash');
```

## Browser (Script Tag)

```html
<script src="https://unpkg.com/@labanimal/compliance/dist/index.global.js"></script>
<script>
  const { calculateMaxDensity, AVMA_METHODS } = LabAnimalCompliance;

  const result = calculateMaxDensity({
    species: 'mouse',
    weightGrams: 22,
    housingStatus: 'group',
    guideStandard: 4,
    protocolApprovedDensity: null,
  });
</script>
```

## Browser (ES Module)

```html
<script type="module">
  import { calculateMaxDensity } from 'https://unpkg.com/@labanimal/compliance/dist/index.mjs';

  const result = calculateMaxDensity({
    /* ... */
  });
</script>
```

## Python (via REST API)

For Python/Rust/Go environments, call the LabAnimal API:

```python
import requests

# Validate euthanasia method
response = requests.post(
    'https://api.labanimal.dev/api/health-records',
    json={
        'animalId': '...',
        'recordType': 'euthanasia',
        'euthanasiaMethodId': 'co2'
    },
    headers={'Authorization': 'Bearer <token>'}
)

# Or use the compliance engine directly via Node.js subprocess
import subprocess
result = subprocess.run(
    ['node', '-e', '''
        const c = require('@labanimal/compliance');
        const r = c.calculateMaxDensity({
            species: 'mouse', weightGrams: 22,
            housingStatus: 'group', guideStandard: 4,
            protocolApprovedDensity: null
        });
        console.log(JSON.stringify(r));
    '''],
    capture_output=True, text=True
)
```

## Edge Runtime (Cloudflare Workers / Vercel Edge)

```typescript
import { calculateMaxDensity, AVMA_METHODS } from '@labanimal/compliance';

export default {
  async fetch(request: Request) {
    const result = calculateMaxDensity({
      species: 'mouse',
      weightGrams: 22,
      housingStatus: 'group',
      guideStandard: 4,
      protocolApprovedDensity: null,
    });
    return Response.json(result);
  },
};
```

## Bundle Sizes

| Format                        | Size (gzip) | Use Case                   |
| ----------------------------- | ----------- | -------------------------- |
| CJS (`dist/index.js`)         | ~8 KB       | Node.js require()          |
| ESM (`dist/index.mjs`)        | ~7 KB       | Modern bundlers, Deno, Bun |
| IIFE (`dist/index.global.js`) | ~8 KB       | Browser script tag         |

## API Reference

All functions are pure (no side effects, no network calls, no file I/O).

### `calculateMaxDensity(input)` → `{ allowed, maxCount, reason }`

### `AVMA_METHODS.validate(species, method, options)` → `{ category, issues }`

### `validateProtocol(input)` → `{ valid, violations, warnings }`

### `isValidStatusTransition(from, to)` → `boolean`

### `sha256(data)` → `Promise<string>`

### `hashAuditEntry(entry)` → `string`

### `verifyAuditEntry(entry)` → `boolean`

See [README.md](./README.md) for full API documentation.
