# 21 CFR Part 11 Compliance

The audit module provides tools for creating tamper-evident audit trails, inspired by [21 CFR Part 11](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-A/part-11) — the FDA regulation for electronic records and electronic signatures.

## What is 21 CFR Part 11?

21 CFR Part 11 is a regulation from the U.S. Food and Drug Administration that establishes criteria under which electronic records and electronic signatures are considered trustworthy, reliable, and equivalent to paper records and handwritten signatures.

Key requirements include:

- **Audit trails** — Secure, computer-generated, time-stamped audit trails
- **Electronic signatures** — Unique signatures linked to their respective records
- **Data integrity** — Protection against unauthorized changes
- **Access controls** — Limiting system access to authorized individuals

## Audit Trail Module

### Diff Generation

Generate structured diffs between two objects:

```typescript
import { generateDiff, summarizeDiff } from '@labanimal/compliance';

const diff = generateDiff(
  { name: 'Alice', age: 25 },
  { name: 'Bob', age: 30, email: 'bob@example.com' }
);

console.log(summarizeDiff(diff));
// ~ name: "Alice" → "Bob"
// ~ age: 25 → 30
// + email: "bob@example.com"
```

### Diff Types

Each diff entry has a type:

| Type | Symbol | Meaning |
|------|--------|---------|
| `added` | `+` | New field added |
| `removed` | `-` | Field removed |
| `changed` | `~` | Field value changed |

### Hash Chain

Create a tamper-evident hash chain linking audit entries:

```typescript
import { hashAuditEntry, GENESIS_HASH } from '@labanimal/compliance';

const entry1 = await hashAuditEntry({
  timestamp: new Date().toISOString(),
  entityType: 'animal',
  entityId: 'anim-001',
  action: 'create',
  diffJson: JSON.stringify({ name: 'Mickey' }),
  previousHash: GENESIS_HASH,
});

const entry2 = await hashAuditEntry({
  timestamp: new Date().toISOString(),
  entityType: 'animal',
  entityId: 'anim-001',
  action: 'update',
  diffJson: JSON.stringify({ weight: 25 }),
  previousHash: entry1.hash,  // Chain to previous entry
});
```

### Hash Algorithm

The hash chain uses **SHA-256** to create a fingerprint of each audit entry. Each entry includes the hash of the previous entry, creating an unbroken chain. Any modification to a historical entry would invalidate all subsequent hashes.

```
Entry 1 (genesis) → Entry 2 → Entry 3 → Entry 4
   SHA-256          SHA-256    SHA-256    SHA-256
```

## Electronic Signatures

The LabAnimal API provides electronic signature endpoints:

```bash
# Create an electronic signature
curl -X POST http://localhost:3000/api/electronic-signatures \
  -H "Content-Type: application/json" \
  -d '{
    "recordType": "protocol",
    "recordId": "proto-001",
    "signerId": "user-001",
    "meaning": "I have reviewed and approved this protocol",
    "signature": "encrypted-signature-data"
  }'
```

## Audit Log

All mutations in the system generate audit log entries:

```bash
# Query audit log for an entity
curl "http://localhost:3000/api/audit-log?entityType=animal&entityId=anim-001"
```

Each audit entry contains:

- `timestamp` — When the change occurred
- `entityType` — Type of entity changed (animal, cage, protocol, etc.)
- `entityId` — ID of the changed entity
- `action` — Action performed (create, update, delete)
- `userId` — Who made the change
- `diff` — Structured diff of the change
- `hash` — SHA-256 hash of the entry
- `previousHash` — Hash of the previous entry (for chain verification)

## Compliance Level

This module is **21 CFR Part 11 inspired**, not certified. It implements the technical controls (audit trails, hash chains, electronic signatures) but does not cover all organizational and procedural requirements. Institutions should:

1. Perform their own Part 11 assessment
2. Implement additional access controls as needed
3. Establish SOPs for electronic signature usage
4. Validate the system per their quality management system
