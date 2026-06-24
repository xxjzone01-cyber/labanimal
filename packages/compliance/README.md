# @labanimal/compliance

LabAnimal compliance engine — zero-dependency TypeScript library for laboratory animal regulatory compliance.

## Features

| Module | Description | Standard |
|--------|-------------|----------|
| **density** | Cage density calculations | Guide for the Care and Use of Laboratory Animals (NRC, 2011) |
| **avma** | Euthanasia method validation | AVMA Guidelines for the Euthanasia of Animals (2020) |
| **iacuc** | Protocol validation (pain categories, 3Rs) | PHS Policy on Humane Care (2015), USDA AWA |
| **audit** | Diff generator, SHA-256 hash chain | 21 CFR Part 11 inspired |

## Install

```bash
npm install @labanimal/compliance
```

## Usage

### Cage Density

```typescript
import { calculateMaxDensity } from '@labanimal/compliance';

const result = calculateMaxDensity({
  species: 'mouse',
  weightGrams: 25,
  currentCount: 3,
  addingCount: 1,
});

if (result.allowed) {
  console.log(`Max ${result.maxCount} per cage`);
} else {
  console.log(`Blocked: ${result.reason}`);
}
```

### Euthanasia Method Validation

```typescript
import { validateMethod } from '@labanimal/compliance';

const result = validateMethod({
  species: 'mouse',
  methodId: 'cervical_dislocation',
  weightGrams: 500,
  performerCertified: true,
});

if (!result.allowed) {
  console.log('Violations:', result.violations);
  console.log('Suggested:', result.suggestedMethods);
}
```

### IACUC Protocol Validation

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

// result.valid, result.violations, result.warnings, result.threeRs
```

### Audit Diff & Hash

```typescript
import { generateDiff, summarizeDiff, hashAuditEntry, GENESIS_HASH } from '@labanimal/compliance';

// Generate diff
const diff = generateDiff(
  { name: 'Alice', age: 25 },
  { name: 'Bob', age: 30, email: 'bob@example.com' }
);
console.log(summarizeDiff(diff));
// ~ name: "Alice" → "Bob"
// ~ age: 25 → 30
// + email: "bob@example.com"

// Hash audit entry (tamper-evident chain)
const hash = await hashAuditEntry({
  timestamp: new Date().toISOString(),
  entityType: 'animal',
  entityId: 'anim-001',
  action: 'update',
  diffJson: JSON.stringify(diff),
  previousHash: GENESIS_HASH,
});
```

## 版权与归属声明

### AVMA 方法分类

本库提供的 AVMA 方法分类基于《AVMA Guidelines for the Euthanasia of Animals (2020)》。

- ✅ 开源内容：方法枚举值、分类标签（acceptable/conditional/unacceptable）
- ❌ 需自行获取许可：AVMA 原始描述文本、完整指南 PDF
- 若需在 UI 中显示方法详细描述，请通过 AVMA 官方渠道获取授权

本库不对 AVMA 指南内容的准确性承担法律责任，使用者应自行核对最新版指南。

### Guide 密度标准

密度计算基于《Guide for the Care and Use of Laboratory Animals》(NRC, 8th ed., 2011) Table 3.1-3.4。使用者应确认所用版本与所在机构采纳的指南版本一致。

## Supported Species

- mouse, rat, hamster, guinea_pig, rabbit

## License

Apache-2.0
