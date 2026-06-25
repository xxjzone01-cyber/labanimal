# Compliance Overview

LabAnimal's compliance engine (`@labanimal/compliance`) is a zero-dependency TypeScript library that encodes regulatory standards directly into your workflow. It validates operations against real-world regulations before data is committed.

## Modules

| Module                                | Description                                                                          | Standard                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| [AVMA Euthanasia](/compliance/avma)   | Validates euthanasia methods against species, weight, and certification requirements | AVMA Guidelines for the Euthanasia of Animals (2020)         |
| [IACUC Protocol](/compliance/iacuc)   | Validates protocol submissions for pain categories, 3Rs, and required fields         | PHS Policy on Humane Care (2015), USDA AWA                   |
| [Cage Density](/compliance/density)   | Calculates maximum animal counts per cage based on species and weight                | Guide for the Care and Use of Laboratory Animals (NRC, 2011) |
| [Audit Trail](/compliance/cfr-part11) | Generates diffs and SHA-256 hash chains for tamper-evident records                   | 21 CFR Part 11 (inspired)                                    |

## Design Principles

### Zero Dependencies

The compliance engine has no external dependencies. It runs in Node.js, browsers, Deno, Bun, and even WebAssembly environments.

### Fail-Safe Validation

All validators return structured results with `allowed`/`valid` flags, violation descriptions, and suggested alternatives. The API layer uses these to block non-compliant operations before they reach the database.

### Standards-Based

Every validation rule traces back to a specific regulatory standard with section references. The source code is the documentation.

## Installation

```bash
npm install @labanimal/compliance
# or
pnpm add @labanimal/compliance
```

## Quick Example

```typescript
import {
  calculateMaxDensity,
  validateMethod,
  validateProtocol,
  generateDiff,
  hashAuditEntry,
} from '@labanimal/compliance';

// All four modules available from a single import
```

## Regulatory Disclaimer

This library provides tooling to assist with regulatory compliance. It does not constitute legal advice. Users are responsible for verifying that their use of the library aligns with their institution's specific policies and the latest versions of referenced standards.
