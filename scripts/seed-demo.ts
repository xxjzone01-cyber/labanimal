/**
 * LabAnimal Demo Lab Seed Script
 *
 * Creates a complete "Demo Lab" with 5 AAALAC teaching scenarios:
 * 1. Over-density cage with IACUC density exemption
 * 2. Quarantined animals pending vet release
 * 3. Retired animal with identity link
 * 4. Single-housed animal (post-surgery recovery)
 * 5. Pending IACUC protocol missing 3R statements
 * 6. AVMA euthanasia method blocking (rabbit + CO2)
 * 7. Environmental enrichment examples
 *
 * Usage: pnpm tsx scripts/seed-demo.ts
 */

import { createPrismaClient } from '../packages/db/src/index.js';
import { hash } from 'bcryptjs';

const prisma = createPrismaClient();

async function main() {
  console.log('🌱 Seeding Demo Lab...\n');

  // Clean existing data
  await prisma.$transaction([
    prisma.electronicSignature.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.enrichment.deleteMany(),
    prisma.healthRecord.deleteMany(),
    prisma.deathReport.deleteMany(),
    prisma.medication.deleteMany(),
    prisma.breeding.deleteMany(),
    prisma.animalIdentifier.deleteMany(),
    prisma.animalLink.deleteMany(),
    prisma.batchSession.deleteMany(),
    prisma.workSession.deleteMany(),
    prisma.training.deleteMany(),
    prisma.animal.deleteMany(),
    prisma.cage.deleteMany(),
    prisma.rack.deleteMany(),
    prisma.room.deleteMany(),
    prisma.protocol.deleteMany(),
    prisma.rate.deleteMany(),
    prisma.userLab.deleteMany(),
    prisma.user.deleteMany(),
    prisma.lab.deleteMany(),
  ]);

  // ── Create Lab ──────────────────────────────────────────────
  const lab = await prisma.lab.create({
    data: {
      name: 'Demo Lab',
      institution: 'University of Example',
      address: '123 Research Blvd, Science City, ST 12345',
    },
  });
  console.log(`  Lab: ${lab.name} (${lab.id})`);

  // ── Create Users ────────────────────────────────────────────
  const password = await hash('password', 10);

  const admin = await prisma.user.create({
    data: { email: 'admin@demo.lab', name: 'Dr. Sarah Chen', passwordHash: password },
  });
  const vet = await prisma.user.create({
    data: { email: 'vet@demo.lab', name: 'Dr. James Wilson (DVM)', passwordHash: password },
  });
  const tech = await prisma.user.create({
    data: { email: 'tech@demo.lab', name: 'Maria Rodriguez (LATG)', passwordHash: password },
  });

  await prisma.userLab.createMany({
    data: [
      { userId: admin.id, labId: lab.id, role: 'admin' },
      { userId: vet.id, labId: lab.id, role: 'veterinarian' },
      { userId: tech.id, labId: lab.id, role: 'caretaker' },
    ],
  });
  console.log(`  Users: admin@demo.lab, vet@demo.lab, tech@demo.lab (all: password)`);

  // ── Create Facility ─────────────────────────────────────────
  const room = await prisma.room.create({
    data: {
      labId: lab.id,
      name: 'Vivarium Room A',
      building: 'Research Building 3',
      floor: 2,
      temperatureMin: 20,
      temperatureMax: 24,
      humidityMin: 40,
      humidityMax: 70,
    },
  });

  const rack = await prisma.rack.create({
    data: { roomId: room.id, name: 'Rack A-1', layers: 4, positionsPerLayer: 5 },
  });

  // Create cages
  const cageNormal1 = await prisma.cage.create({
    data: { rackId: rack.id, position: 'A-1-1', capacity: 5, status: 'occupied' },
  });
  const cageNormal2 = await prisma.cage.create({
    data: { rackId: rack.id, position: 'A-1-2', capacity: 5, status: 'occupied' },
  });
  const cageOverDensity = await prisma.cage.create({
    data: { rackId: rack.id, position: 'A-1-3', capacity: 4, status: 'occupied' },
  });
  const cageQuarantine = await prisma.cage.create({
    data: { rackId: rack.id, position: 'A-2-1', capacity: 5, status: 'occupied' },
  });
  const cageSingle = await prisma.cage.create({
    data: {
      rackId: rack.id,
      position: 'A-2-2',
      capacity: 5,
      status: 'occupied',
      isSingleHoused: true,
      singleHousingReason: 'Post-surgery recovery (48h monitoring)',
    },
  });
  const cageEmpty = await prisma.cage.create({
    data: { rackId: rack.id, position: 'A-3-1', capacity: 5, status: 'empty' },
  });

  // ── Create Protocols ────────────────────────────────────────
  const protocolApproved = await prisma.protocol.create({
    data: {
      labId: lab.id,
      title: 'Immunodeficient Mouse Colonization',
      description: 'Breeding and maintenance of NSG mouse colony for cancer research',
      piName: 'Dr. Sarah Chen',
      iacucNumber: 'IACUC-2024-001',
      status: 'approved',
      painCategory: 'B',
      startDate: new Date('2024-01-15'),
      endDate: new Date('2027-01-14'),
      animalLimit: 200,
      densityExemption: 6, // IACUC-approved higher density
      threeRsReplacement: 'Considered in silico models; not feasible for immune system studies',
      threeRsReduction: 'Power analysis indicates n=5 minimum per group',
      threeRsRefinement: 'Buprenorphine SRM for all surgical procedures',
      hasStatisticalJustification: true,
      involvesSurgery: true,
      survivalSurgery: true,
      usesAnalgesics: true,
      hasHumaneEndpoints: true,
      approvedAt: new Date('2024-01-10'),
      approvedBy: admin.id,
    },
  });

  const protocolPending = await prisma.protocol.create({
    data: {
      labId: lab.id,
      title: 'Novel Pain Assessment in Rats',
      description: 'Evaluating MGS/RGS reliability for post-operative pain scoring',
      piName: 'Dr. James Wilson',
      iacucNumber: null, // Not yet assigned
      status: 'submitted',
      painCategory: 'D',
      animalLimit: 50,
      // Missing 3R statements — teaching scenario
    },
  });
  console.log(
    `  Protocols: ${protocolApproved.iacucNumber} (approved), ${protocolPending.title} (submitted)`,
  );

  // ── Scenario 1: Over-density cage ───────────────────────────
  console.log('\n  📦 Scenario 1: Over-density cage (6 mice in capacity-4 cage)');
  for (let i = 1; i <= 6; i++) {
    const animal = await prisma.animal.create({
      data: {
        labId: lab.id,
        internalId: `NSG-${String(i).padStart(3, '0')}`,
        species: 'mouse',
        strain: 'NSG',
        genotype: 'Prkdc^scid Il2rg^tm1Wjl',
        sex: i <= 3 ? 'male' : 'female',
        dateOfBirth: new Date('2024-03-01'),
        arrivalDate: new Date('2024-04-01'),
        source: 'The Jackson Laboratory',
        cageId: cageOverDensity.id,
        protocolId: protocolApproved.id,
        status: 'active',
        quarantineStatus: 'released',
      },
    });

    await prisma.animalIdentifier.create({
      data: {
        animalId: animal.id,
        type: 'ear_tag',
        value: `E-${String(i).padStart(3, '0')}`,
        isPrimary: true,
      },
    });
  }
  console.log('    → 6 NSG mice in cage A-1-3 (capacity: 4) with IACUC density exemption');

  // ── Scenario 2: Quarantined animals ─────────────────────────
  console.log('  🔒 Scenario 2: Quarantined animals (pending vet release)');
  for (let i = 7; i <= 9; i++) {
    await prisma.animal.create({
      data: {
        labId: lab.id,
        internalId: `C57-${String(i).padStart(3, '0')}`,
        species: 'mouse',
        strain: 'C57BL/6J',
        sex: i === 7 ? 'male' : 'female',
        dateOfBirth: new Date('2024-05-15'),
        arrivalDate: new Date(),
        source: 'Charles River Laboratories',
        cageId: cageQuarantine.id,
        status: 'active',
        quarantineStatus: 'quarantined',
        quarantineUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
        notes: 'New arrival — standard quarantine protocol. Health check pending.',
      },
    });
  }
  console.log('    → 3 C57BL/6J mice in quarantine (14-day hold)');

  // ── Scenario 3: Identity deprecation ────────────────────────
  console.log('  🔄 Scenario 3: Identity deprecation (ear tag fell off)');
  const oldAnimal = await prisma.animal.create({
    data: {
      labId: lab.id,
      internalId: 'M-001',
      species: 'mouse',
      strain: 'BALB/c',
      sex: 'female',
      dateOfBirth: new Date('2024-01-10'),
      arrivalDate: new Date('2024-02-01'),
      source: 'Taconic',
      cageId: cageNormal1.id,
      protocolId: protocolApproved.id,
      status: 'retired',
      quarantineStatus: 'released',
      notes: 'Ear tag fell off during cage change. Identity cannot be confirmed.',
    },
  });

  const newAnimal = await prisma.animal.create({
    data: {
      labId: lab.id,
      internalId: 'M-999',
      species: 'mouse',
      strain: 'BALB/c',
      sex: 'female',
      dateOfBirth: new Date('2024-01-10'),
      arrivalDate: new Date('2024-02-01'),
      source: 'Taconic',
      cageId: cageNormal1.id,
      protocolId: protocolApproved.id,
      status: 'active',
      quarantineStatus: 'released',
      notes: 'Re-tagged after ear tag loss. See linked record M-001 for history.',
    },
  });

  await prisma.animalLink.create({
    data: {
      animalId: oldAnimal.id,
      linkedToId: newAnimal.id,
      reason: 'ear_tag_fell_off',
    },
  });
  console.log('    → M-001 (retired) linked to M-999 (active)');

  // ── Scenario 4: Single housing ──────────────────────────────
  console.log('  🏠 Scenario 4: Single-housed animal (post-surgery)');
  const surgeryAnimal = await prisma.animal.create({
    data: {
      labId: lab.id,
      internalId: 'BALB-005',
      species: 'mouse',
      strain: 'BALB/c',
      sex: 'male',
      dateOfBirth: new Date('2024-04-01'),
      arrivalDate: new Date('2024-05-01'),
      source: 'The Jackson Laboratory',
      cageId: cageSingle.id,
      protocolId: protocolApproved.id,
      status: 'active',
      quarantineStatus: 'released',
    },
  });

  await prisma.healthRecord.create({
    data: {
      animalId: surgeryAnimal.id,
      recordType: 'treatment',
      bodyConditionScore: 2,
      painScore: 0.35,
      painScoreType: 'MGS',
      description: 'Post-surgical observation: tumor resection site clean, animal alert',
      treatment: 'Buprenorphine SRM 0.1mg/kg SC',
      recordedBy: vet.id,
    },
  });
  console.log('    → BALB-005 single-housed for 48h post-surgery recovery');

  // ── Scenario 5: AVMA euthanasia blocking ────────────────────
  console.log('  🐰 Scenario 5: AVMA euthanasia blocking (rabbit + CO2)');
  const rabbit = await prisma.animal.create({
    data: {
      labId: lab.id,
      internalId: 'RAB-001',
      species: 'rabbit',
      strain: 'New Zealand White',
      sex: 'male',
      dateOfBirth: new Date('2024-02-01'),
      arrivalDate: new Date('2024-03-01'),
      source: 'Covance',
      cageId: cageNormal2.id,
      status: 'active',
      quarantineStatus: 'released',
    },
  });
  console.log('    → RAB-001 (rabbit): CO2 euthanasia will be blocked by AVMA validator');

  // ── Scenario 6: Enrichment ──────────────────────────────────
  console.log('  🧸 Scenario 6: Environmental enrichment');
  await prisma.enrichment.createMany({
    data: [
      {
        cageId: cageOverDensity.id,
        type: 'nesting_material',
        description: 'Nestlets (2 per cage)',
        addedBy: tech.id,
      },
      {
        cageId: cageOverDensity.id,
        type: 'hut',
        description: 'Small plastic shelter',
        addedBy: tech.id,
      },
      {
        cageId: cageNormal1.id,
        type: 'nesting_material',
        description: 'Nestlets',
        addedBy: tech.id,
      },
      {
        cageId: cageSingle.id,
        type: 'hut',
        description: 'Post-surgery comfort shelter',
        addedBy: vet.id,
      },
      {
        cageId: cageSingle.id,
        type: 'chew_block',
        description: 'Wood chew block',
        addedBy: tech.id,
      },
    ],
  });
  console.log('    → Enrichment items added to 3 cages');

  // ── Create Rates ────────────────────────────────────────────
  await prisma.rate.createMany({
    data: [
      { labId: lab.id, species: 'mouse', dailyRate: 0.85, cageRate: 0.15 },
      { labId: lab.id, species: 'rat', dailyRate: 1.2, cageRate: 0.25 },
      { labId: lab.id, species: 'rabbit', dailyRate: 3.5, cageRate: 1.0 },
    ],
  });

  // ── Create Training records ─────────────────────────────────
  await prisma.training.createMany({
    data: [
      {
        userId: vet.id,
        labId: lab.id,
        type: 'euthanasia',
        certificationNumber: 'AVMA-2024-001',
        issuedBy: 'AALAS',
        issuedDate: new Date('2024-01-01'),
        expirationDate: new Date('2027-01-01'),
        status: 'active',
      },
      {
        userId: tech.id,
        labId: lab.id,
        type: 'species_specific',
        certificationNumber: 'AALAS-LATG-2023',
        issuedBy: 'AALAS',
        issuedDate: new Date('2023-06-01'),
        expirationDate: new Date('2026-06-01'),
        status: 'active',
        notes: 'Mouse and rat handling certified',
      },
    ],
  });

  console.log('\n✅ Demo Lab seeded successfully!');
  console.log('   Login: admin@demo.lab / password');
  console.log('   Visit: http://localhost:5173\n');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
