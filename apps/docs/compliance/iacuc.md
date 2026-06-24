# IACUC Protocol Compliance

The IACUC module validates protocol submissions against Institutional Animal Care and Use Committee requirements, based on the PHS Policy on Humane Care and Use of Laboratory Animals (2015) and the USDA Animal Welfare Act (AWA).

## Pain Categories

Protocols must specify a pain category as defined by USDA:

| Category | Description |
|----------|-------------|
| **B** | No more than momentary or slight pain or distress |
| **C** | Pain or distress relieved by appropriate anesthetics/analgesics |
| **D** | Pain or distress not relieved by anesthetics/analgesics (requires scientific justification) |
| **E** | Pain or distress without relief (requires extraordinary scientific justification) |

## The 3Rs

The validator checks compliance with the 3Rs framework:

| R | Description | Check |
|---|-------------|-------|
| **Replacement** | Use alternatives to animals when possible | `alternativesConsidered` must be true |
| **Reduction** | Use the minimum number of animals | `hasStatisticalJustification` must be true |
| **Refinement** | Minimize pain and distress | `usesAnalgesics` and `hasHumaneEndpoints` must be true (for categories C–E) |

## Usage

```typescript
import { validateProtocol } from '@labanimal/compliance';

const result = validateProtocol({
  title: 'Effect of Drug X on Mouse Behavior',
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

console.log('Valid:', result.valid);
console.log('Violations:', result.violations);
console.log('Warnings:', result.warnings);
console.log('3Rs status:', result.threeRs);
```

## Validation Checks

### Required Fields

- `title` — Protocol title
- `piName` — Principal investigator name
- `species` — At least one species must be specified
- `animalCounts` — Animal count per species
- `painCategory` — Must be B, C, D, or E

### Pain Category D/E Requirements

For protocols in pain categories D or E:

- `usesAnalgesics` must be true (or scientific justification must be provided)
- `hasHumaneEndpoints` must be true
- Detailed justification for the use of unrelieved pain is required

### Surgery Requirements

If `involvesSurgery` is true:

- `personnelTrained` must be true
- If `survivalSurgery` is true, additional documentation is required

### Warnings

The validator also returns non-blocking warnings for:

- Large animal counts without explicit statistical justification
- Multiple species without per-species justification
- Protocols using category E procedures

## Response Structure

```typescript
interface ProtocolValidationResult {
  valid: boolean;
  violations: string[];   // Blocking issues
  warnings: string[];     // Non-blocking suggestions
  threeRs: {
    replacement: boolean;
    reduction: boolean;
    refinement: boolean;
  };
}
```
