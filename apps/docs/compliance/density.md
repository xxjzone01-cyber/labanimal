# Cage Density Guidelines

The density module calculates maximum animal counts per cage based on the [Guide for the Care and Use of Laboratory Animals](https://nap.nationalacademies.org/catalog/12910/guide-for-the-care-and-use-of-laboratory-animals-eighth) (NRC, 8th Edition, 2011), Tables 3.1–3.4.

## Supported Species

| Species    | Reference       |
| ---------- | --------------- |
| Mouse      | Guide Table 3.1 |
| Rat        | Guide Table 3.2 |
| Hamster    | Guide Table 3.3 |
| Guinea pig | Guide Table 3.4 |
| Rabbit     | Guide Table 3.4 |

## Usage

```typescript
import { calculateMaxDensity } from '@labanimal/compliance';

const result = calculateMaxDensity({
  species: 'mouse',
  weightGrams: 25,
  currentCount: 3,
  addingCount: 1,
});

if (result.allowed) {
  console.log(`Allowed. Max ${result.maxCount} per cage.`);
} else {
  console.log(`Blocked: ${result.reason}`);
  console.log(`Current: ${result.currentCount}, Max: ${result.maxCount}`);
}
```

## How It Works

The density calculator determines the maximum number of animals allowed per cage based on:

1. **Species** — Different species have different space requirements
2. **Body weight** — Heavier animals require more floor space
3. **Cage floor area** — Standard cage dimensions are used (configurable)

The calculation uses the floor area per animal values from the NRC Guide tables, which specify minimum floor space in square inches per animal for different weight ranges.

## Weight-Based Tiers

Space requirements increase with body weight. For example, mice:

| Weight Range | Floor Space per Animal |
| ------------ | ---------------------- |
| Up to 10g    | 6 sq in                |
| 10–15g       | 8 sq in                |
| 15–25g       | 12 sq in               |
| Over 25g     | 15 sq in               |

## Response Structure

```typescript
interface DensityResult {
  allowed: boolean;
  maxCount: number; // Maximum animals allowed
  currentCount: number; // Current animals in cage
  addingCount: number; // Animals being added
  reason?: string; // Explanation if blocked
  floorAreaSqIn: number; // Cage floor area used
  requiredSqIn: number; // Required floor space per animal
}
```

## Integration with Cage Operations

In the LabAnimal API, density validation runs automatically before any cage assignment:

```bash
# This will be blocked if it exceeds density limits
curl -X POST http://localhost:3000/api/cages/assign \
  -H "Content-Type: application/json" \
  -d '{"cageId":"cage-001","animalId":"anim-042"}'
```

The API returns a `409 Conflict` with the density violation details if the operation would exceed limits.

## Standards Reference

The density calculations are based on:

> **Guide for the Care and Use of Laboratory Animals**
> National Research Council, 8th Edition, 2011
> Tables 3.1–3.4: Space Recommendations for Commonly Used Laboratory Animals

Users should confirm that the edition used matches their institution's adopted standard.
