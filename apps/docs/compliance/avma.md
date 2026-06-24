# AVMA Euthanasia Compliance

The AVMA module validates euthanasia methods against the [AVMA Guidelines for the Euthanasia of Animals (2020 Edition)](https://www.avma.org/resources-tools/avma-policies/avma-guidelines-euthanasia-animals).

## Method Classifications

Each method is classified into one of three categories:

| Classification | Meaning |
|----------------|---------|
| **Acceptable** | Conditionally acceptable with documented justification |
| **Conditional** | May be acceptable under specific conditions (e.g., field conditions, emergency) |
| **Unacceptable** | Not permitted under any circumstances |

## Supported Methods

The engine includes the following euthanasia methods:

| Method ID | Description | Classification |
|-----------|-------------|----------------|
| `cervical_dislocation` | Cervical dislocation | Acceptable (with weight limits) |
| `co2_inhalation` | CO₂ inhalation | Acceptable |
| `isoflurane` | Isoflurane overdose | Acceptable |
| `injectable_barbiturate` | Injectable barbiturate (e.g., pentobarbital) | Acceptable |
| `decapitation` | Decapitation | Conditional |
| `captive_bolt` | Captive bolt | Conditional |

## Usage

```typescript
import { validateMethod } from '@labanimal/compliance';

const result = validateMethod({
  species: 'mouse',
  methodId: 'cervical_dislocation',
  weightGrams: 500,
  performerCertified: true,
});

if (result.allowed) {
  console.log('Method approved');
} else {
  console.log('Violations:', result.violations);
  console.log('Suggested alternatives:', result.suggestedMethods);
}
```

## Validation Rules

The validator checks:

1. **Species compatibility** — Is the method acceptable for this species?
2. **Weight limits** — Some methods (e.g., cervical dislocation) have maximum weight thresholds
3. **Certification** — Does the performer have the required certification?
4. **Method classification** — Is the method acceptable, conditional, or unacceptable?

## Weight Restrictions

Certain methods have species-specific weight limits:

| Species | Method | Max Weight |
|---------|--------|------------|
| Mouse | Cervical dislocation | 200g |
| Rat | Cervical dislocation | 500g |

Attempts to use these methods on animals exceeding the weight limit will return a violation with suggested alternatives.

## Suggested Methods

When a method is rejected, the validator returns a list of suggested alternatives that are acceptable for the given species and weight. This helps users quickly find a compliant replacement.

## Copyright Notice

The method enumerations and classification labels (acceptable/conditional/unacceptable) are based on publicly available information from the AVMA Guidelines. The original AVMA guide text and full PDF require separate licensing from AVMA. Users should verify against the latest edition of the guidelines.
