/**
 * LabAnimal database seed script
 * Creates AAALAC simulation review scenarios for demo
 * Usage: pnpm db:seed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with AAALAC demo scenarios...');

  // Clean existing data
  await prisma.auditLog.deleteMany();
  await prisma.electronicSignature.deleteMany();
  await prisma.training.deleteMany();
  await prisma.workSession.deleteMany();
  await prisma.enrichment.deleteMany();
  await prisma.medication.deleteMany();
  await prisma.healthRecord.deleteMany();
  await prisma.deathReport.deleteMany();
  await prisma.breeding.deleteMany();
  await prisma.animalIdentifier.deleteMany();
  await prisma.animalLink.deleteMany();
  await prisma.animal.deleteMany();
  await prisma.cage.deleteMany();
  await prisma.rack.deleteMany();
  await prisma.room.deleteMany();
  await prisma.protocol.deleteMany();
  await prisma.rate.deleteMany();
  await prisma.userLab.deleteMany();
  await prisma.user.deleteMany();
  await prisma.lab.deleteMany();

  console.log('✅ Cleaned existing data');

  // ============================================================
  // 1. Create Demo Lab with Users
  // ============================================================

  const lab = await prisma.lab.create({
    data: {
      name: 'Demo Animal Facility',
      institution: 'University of Example',
      address: '123 Research Blvd, Science City, SC 12345',
    },
  });

  const pi = await prisma.user.create({
    data: {
      email: 'admin@demo.lab',
      name: 'Dr. Jane Smith',
      passwordHash: '$2a$12$8U8LRorPwS5d4J8quv2TROugaVMqPudHQbEC6YU5kNydEU23oqbqW', // password
      labs: { create: { labId: lab.id, role: 'pi' } },
    },
  });

  const caretaker = await prisma.user.create({
    data: {
      email: 'caretaker@demo.lab',
      name: 'John Doe',
      passwordHash: '$2a$12$8U8LRorPwS5d4J8quv2TROugaVMqPudHQbEC6YU5kNydEU23oqbqW',
      labs: { create: { labId: lab.id, role: 'caretaker' } },
    },
  });

  const vet = await prisma.user.create({
    data: {
      email: 'vet@demo.lab',
      name: 'Dr. Bob Wilson',
      passwordHash: '$2a$12$8U8LRorPwS5d4J8quv2TROugaVMqPudHQbEC6YU5kNydEU23oqbqW',
      labs: { create: { labId: lab.id, role: 'veterinarian' } },
    },
  });

  const researcher = await prisma.user.create({
    data: {
      email: 'researcher@demo.lab',
      name: 'Alice Chen',
      passwordHash: '$2a$12$8U8LRorPwS5d4J8quv2TROugaVMqPudHQbEC6YU5kNydEU23oqbqW',
      labs: { create: { labId: lab.id, role: 'researcher' } },
    },
  });

  console.log(`✅ Created lab: ${lab.name} with 4 users`);

  // ============================================================
  // 2. Create Rooms, Racks, and Cages
  // ============================================================

  const roomA = await prisma.room.create({
    data: {
      labId: lab.id,
      name: 'Room A-101',
      building: 'Building A',
      floor: 1,
      location: 'North Wing',
      temperatureMin: 20,
      temperatureMax: 26,
      humidityMin: 40,
      humidityMax: 70,
    },
  });

  const roomB = await prisma.room.create({
    data: {
      labId: lab.id,
      name: 'Room B-201',
      building: 'Building B',
      floor: 2,
      location: 'South Wing',
      temperatureMin: 18,
      temperatureMax: 24,
      humidityMin: 35,
      humidityMax: 65,
    },
  });

  const rackA1 = await prisma.rack.create({
    data: { labId: lab.id, roomId: roomA.id, name: 'Rack A1', layers: 4, positionsPerLayer: 5 },
  });

  const rackA2 = await prisma.rack.create({
    data: { labId: lab.id, roomId: roomA.id, name: 'Rack A2', layers: 3, positionsPerLayer: 4 },
  });

  const rackB1 = await prisma.rack.create({
    data: { labId: lab.id, roomId: roomB.id, name: 'Rack B1', layers: 4, positionsPerLayer: 5 },
  });

  // Create cages
  const cages: any[] = [];
  for (let pos = 1; pos <= 5; pos++) {
    const cage = await prisma.cage.create({
      data: {
        labId: lab.id,
        rackId: rackA1.id,
        position: `A1-${pos}`,
        status: 'occupied',
        capacity: 5,
      },
    });
    cages.push(cage);
  }

  // Scenario cage: single housing
  const singleHousingCage = await prisma.cage.create({
    data: {
      labId: lab.id,
      rackId: rackA2.id,
      position: 'A2-1',
      status: 'occupied',
      capacity: 1,
      isSingleHoused: true,
      singleHousingReason: 'Post-surgery recovery',
      singleHousingUntil: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h from now
    },
  });

  // Quarantine cages
  const quarantineCage = await prisma.cage.create({
    data: {
      labId: lab.id,
      rackId: rackB1.id,
      position: 'B1-1',
      status: 'occupied',
      capacity: 5,
    },
  });

  console.log('✅ Created rooms, racks, and cages');

  // ============================================================
  // 3. Create Protocols
  // ============================================================

  // Approved protocol with density exemption
  const protocolApproved = await prisma.protocol.create({
    data: {
      labId: lab.id,
      title: 'Effect of Anesthetic X on Mouse Behavior',
      piName: pi.name,
      iacucNumber: 'IACUC-2024-001',
      status: 'approved',
      painCategory: 'D',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2026-12-31'),
      animalLimit: 50,
      threeRsReplacement: 'Considered in vitro alternatives but requires whole organism response',
      threeRsReduction: 'Power analysis indicates n=5 per group minimum',
      threeRsRefinement: 'Analgesics provided post-surgery, daily health monitoring',
      involvesSurgery: true,
      survivalSurgery: true,
      usesAnalgesics: true,
      hasHumaneEndpoints: true,
      hasStatisticalJustification: true,
    },
  });

  // Submitted protocol (missing 3Rs - for teaching)
  const protocolSubmitted = await prisma.protocol.create({
    data: {
      labId: lab.id,
      title: 'Novel Drug Testing in Rats',
      piName: researcher.name,
      iacucNumber: 'IACUC-2024-002',
      status: 'submitted',
      painCategory: 'E',
      animalLimit: 30,
      // Missing 3Rs statements - will fail validation
    },
  });

  console.log('✅ Created protocols');

  // ============================================================
  // 4. Scenario 1: Overcrowded Cage (with protocol exemption)
  // ============================================================

  const overcrowdedMice = [
    { internalId: 'M-OC-001', strain: 'C57BL/6', sex: 'male', weight: 25 },
    { internalId: 'M-OC-002', strain: 'C57BL/6', sex: 'male', weight: 26 },
    { internalId: 'M-OC-003', strain: 'C57BL/6', sex: 'male', weight: 24 },
    { internalId: 'M-OC-004', strain: 'C57BL/6', sex: 'male', weight: 27 },
    { internalId: 'M-OC-005', strain: 'C57BL/6', sex: 'male', weight: 25 },
    { internalId: 'M-OC-006', strain: 'C57BL/6', sex: 'male', weight: 26 },
  ];

  for (const mouse of overcrowdedMice) {
    await prisma.animal.create({
      data: {
        labId: lab.id,
        internalId: mouse.internalId,
        species: 'mouse',
        strain: mouse.strain,
        sex: mouse.sex,
        dateOfBirth: new Date('2024-06-01'),
        source: 'Jackson Laboratory',
        cageId: cages[0].id, // All in same cage
        protocolId: protocolApproved.id,
        status: 'active',
      },
    });
  }

  // Add enrichment to overcrowded cage
  await prisma.enrichment.create({
    data: {
      labId: lab.id,
      cageId: cages[0].id,
      type: 'nesting_material',
      description: 'Nesting cotton squares',
    },
  });

  await prisma.enrichment.create({
    data: {
      labId: lab.id,
      cageId: cages[0].id,
      type: 'hut',
      description: 'Plastic shelter hut',
    },
  });

  console.log('✅ Scenario 1: Overcrowded cage with 6 mice (protocol exemption)');

  // ============================================================
  // 5. Scenario 2: Quarantine Animals
  // ============================================================

  const quarantineMice = [
    { internalId: 'M-QA-001', arrivalDate: new Date() },
    { internalId: 'M-QA-002', arrivalDate: new Date() },
    { internalId: 'M-QA-003', arrivalDate: new Date() },
  ];

  for (const mouse of quarantineMice) {
    await prisma.animal.create({
      data: {
        labId: lab.id,
        internalId: mouse.internalId,
        species: 'mouse',
        strain: 'BALB/c',
        sex: 'female',
        dateOfBirth: new Date('2024-03-15'),
        arrivalDate: mouse.arrivalDate,
        source: 'Charles River Laboratories',
        cageId: quarantineCage.id,
        quarantineStatus: 'quarantined',
        quarantineUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
        status: 'active',
      },
    });
  }

  console.log('✅ Scenario 2: 3 quarantined mice (14-day countdown)');

  // ============================================================
  // 6. Scenario 3: Identity Link (ear tag fell off)
  // ============================================================

  const retiredMouse = await prisma.animal.create({
    data: {
      labId: lab.id,
      internalId: 'M-001',
      species: 'mouse',
      strain: 'C57BL/6',
      sex: 'male',
      dateOfBirth: new Date('2024-01-10'),
      source: 'Jackson Laboratory',
      status: 'retired', // Retired due to ear tag issue
    },
  });

  const newMouse = await prisma.animal.create({
    data: {
      labId: lab.id,
      internalId: 'M-999',
      species: 'mouse',
      strain: 'C57BL/6',
      sex: 'male',
      dateOfBirth: new Date('2024-01-10'),
      source: 'Jackson Laboratory',
      cageId: cages[1].id,
      protocolId: protocolApproved.id,
      status: 'active',
    },
  });

  await prisma.animalLink.create({
    data: {
      labId: lab.id,
      animalId: retiredMouse.id,
      linkedToId: newMouse.id,
      reason: 'ear_tag_fell_off',
    },
  });

  // Add identifier to new mouse
  await prisma.animalIdentifier.create({
    data: {
      labId: lab.id,
      animalId: newMouse.id,
      type: 'ear_tag',
      value: '999',
      isPrimary: true,
    },
  });

  await prisma.animalIdentifier.create({
    data: {
      labId: lab.id,
      animalId: newMouse.id,
      type: 'microchip',
      value: 'MC-2024-001',
      isPrimary: false,
    },
  });

  console.log('✅ Scenario 3: Identity link (M-001 retired → M-999)');

  // ============================================================
  // 7. Scenario 4: Single Housing (post-surgery)
  // ============================================================

  const singleHousedMouse = await prisma.animal.create({
    data: {
      labId: lab.id,
      internalId: 'M-SH-001',
      species: 'mouse',
      strain: 'C57BL/6',
      sex: 'female',
      dateOfBirth: new Date('2024-04-20'),
      source: 'Jackson Laboratory',
      cageId: singleHousingCage.id,
      protocolId: protocolApproved.id,
      status: 'active',
    },
  });

  // Add health record for surgery
  await prisma.healthRecord.create({
    data: {
      labId: lab.id,
      animalId: singleHousedMouse.id,
      recordType: 'treatment',
      weight: 22,
      bodyConditionScore: 3,
      description: 'Ovariectomy surgery performed',
      treatment: 'Buprenorphine 0.05mg/kg SC q12h x 3 days',
      recordedBy: vet.id,
    },
  });

  console.log('✅ Scenario 4: Single-housed mouse (post-surgery recovery)');

  // ============================================================
  // 8. Scenario 5: AVMA Blocking Example (Rabbit + CO2)
  // ============================================================

  const rabbit = await prisma.animal.create({
    data: {
      labId: lab.id,
      internalId: 'R-001',
      species: 'rabbit',
      strain: 'New Zealand White',
      sex: 'female',
      dateOfBirth: new Date('2024-02-01'),
      source: 'Charles River Laboratories',
      cageId: cages[2].id,
      protocolId: protocolApproved.id,
      status: 'active',
    },
  });

  console.log('✅ Scenario 5: Rabbit created (CO2 euthanasia will be blocked by AVMA)');

  // ============================================================
  // 9. Create Additional Normal Animals
  // ============================================================

  const normalMice = [
    { internalId: 'M-010', strain: 'C57BL/6', sex: 'male', cage: cages[1] },
    { internalId: 'M-011', strain: 'C57BL/6', sex: 'female', cage: cages[1] },
    { internalId: 'M-012', strain: 'BALB/c', sex: 'male', cage: cages[3] },
    { internalId: 'M-013', strain: 'BALB/c', sex: 'female', cage: cages[3] },
    { internalId: 'M-014', strain: 'C57BL/6', sex: 'male', cage: cages[4] },
  ];

  for (const mouse of normalMice) {
    await prisma.animal.create({
      data: {
        labId: lab.id,
        internalId: mouse.internalId,
        species: 'mouse',
        strain: mouse.strain,
        sex: mouse.sex,
        dateOfBirth: new Date('2024-05-01'),
        source: 'Jackson Laboratory',
        cageId: mouse.cage.id,
        protocolId: protocolApproved.id,
        status: 'active',
      },
    });
  }

  console.log('✅ Created 5 additional normal mice');

  // ============================================================
  // 10. Create Training Records
  // ============================================================

  await prisma.training.create({
    data: {
      userId: caretaker.id,
      labId: lab.id,
      type: 'aalas_lat',
      certificationNumber: 'LAT-2024-001',
      issuedBy: 'AALAS',
      issuedDate: new Date('2024-01-15'),
      expirationDate: new Date('2027-01-15'),
      status: 'active',
    },
  });

  await prisma.training.create({
    data: {
      userId: vet.id,
      labId: lab.id,
      type: 'euthanasia',
      certificationNumber: 'EUTH-2024-001',
      issuedBy: 'IACUC',
      issuedDate: new Date('2024-03-01'),
      expirationDate: new Date('2025-03-01'),
      status: 'active',
    },
  });

  await prisma.training.create({
    data: {
      userId: researcher.id,
      labId: lab.id,
      type: 'iacuc_orientation',
      issuedBy: 'IACUC',
      issuedDate: new Date('2024-06-01'),
      status: 'active',
    },
  });

  console.log('✅ Created training records');

  // ============================================================
  // 11. Create Billing Rates
  // ============================================================

  await prisma.rate.create({
    data: { labId: lab.id, species: 'mouse', dailyRate: 0.50, cageRate: 1.00 },
  });

  await prisma.rate.create({
    data: { labId: lab.id, species: 'rat', dailyRate: 1.50, cageRate: 2.00 },
  });

  await prisma.rate.create({
    data: { labId: lab.id, species: 'rabbit', dailyRate: 5.00, cageRate: 8.00 },
  });

  console.log('✅ Created billing rates');

  // ============================================================
  // Summary
  // ============================================================

  console.log('\n🎉 Seed complete! AAALAC Demo Scenarios:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1. Overcrowded cage: 6 mice in cage A1-1 (protocol exemption)');
  console.log('2. Quarantine: 3 mice in Room B-201 (14-day countdown)');
  console.log('3. Identity link: M-001 retired → M-999 (ear tag fell off)');
  console.log('4. Single housing: M-SH-001 (post-surgery, 48h limit)');
  console.log('5. AVMA block: Rabbit R-001 (CO2 will be rejected)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\nDefault login: admin@demo.lab / password');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
