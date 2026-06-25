---
layout: home

hero:
  name: LabAnimal
  text: Open-Source Lab Animal Management
  tagline: A modern, compliance-first platform for managing laboratory animal research programs — from cage tracking to IACUC protocol validation.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/
    - theme: alt
      text: View on GitHub
      link: https://github.com/xxjzone01-cyber/labanimal

features:
  - icon: "\U0001F9EB"
    title: Cage & Animal Management
    details: Track animals, cages, rooms, and racks with real-time occupancy and density monitoring.
  - icon: "\U0001F6E1\uFE0F"
    title: Compliance Engine
    details: Built-in validation for AVMA euthanasia guidelines, IACUC protocols, cage density standards, and 21 CFR Part 11 audit trails.
  - icon: "\U0001F4CA"
    title: Breeding & Health Records
    details: Manage breeding colonies, health records, medications, and death reports in one place.
  - icon: "\U0001F512"
    title: Electronic Signatures
    details: 21 CFR Part 11 compliant electronic signatures with tamper-evident SHA-256 hash chains.
  - icon: "\U0001F4B0"
    title: Billing & Rates
    details: Configure per-diem rates, track work sessions, and generate billing reports.
  - icon: "\U0001F6E0\uFE0F"
    title: Extensible API
    details: RESTful API with OpenAPI spec, ready for integration with LIMS, vivarium systems, and institutional portals.
---

## Quick Example

```bash
# Clone and install
git clone https://github.com/xxjzone01-cyber/labanimal.git
cd labanimal
pnpm install

# Start development
pnpm dev
```

## Compliance at the Core

LabAnimal ships with `@labanimal/compliance`, a zero-dependency TypeScript library that encodes regulatory standards directly into your workflow:

- **Cage density** calculations based on NRC Guide (2011)
- **AVMA euthanasia** method validation (2020 edition)
- **IACUC protocol** checks covering pain categories and the 3Rs
- **Audit trail** with diff generation and SHA-256 hash chains

## License

LabAnimal is released under the [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0) license.
