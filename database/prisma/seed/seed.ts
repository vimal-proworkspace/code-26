import { PrismaClient, UserRole, EventStatus, RoundType, RoundStatus } from '@prisma/client';

let bcrypt: typeof import('bcrypt');
try {
  bcrypt = require('bcrypt');
} catch {
  bcrypt = require('../../../backend/node_modules/bcrypt');
}

const prisma = new PrismaClient();

const SALT_ROUNDS = 10;
const DEFAULT_ADMIN_USERNAME = process.env.DEFAULT_ADMIN_USERNAME || 'admin@it.com';
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'admin@it';
const DEFAULT_STUDENT_PASSWORD = process.env.DEFAULT_STUDENT_PASSWORD || 'welcome@sara';
const BATCH_NUMBER = '284001';

async function main() {
  console.log('Starting Coding Event Platform 2026 Database Seed...');

  // 1. Hash default credentials with bcrypt
  const adminPasswordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, SALT_ROUNDS);
  const studentPasswordHash = await bcrypt.hash(DEFAULT_STUDENT_PASSWORD, SALT_ROUNDS);

  // 2. Upsert Batch
  const batch = await prisma.batch.upsert({
    where: { batchNumber: BATCH_NUMBER },
    update: { name: `Batch ${BATCH_NUMBER}` },
    create: {
      batchNumber: BATCH_NUMBER,
      name: `Batch ${BATCH_NUMBER}`,
      description: 'Initial Student Batch 2026',
    },
  });
  console.log(`✓ Batch verified: ${batch.batchNumber}`);

  // 3. Upsert Admin Account
  const adminUser = await prisma.user.upsert({
    where: { username: DEFAULT_ADMIN_USERNAME },
    update: {
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
    create: {
      username: DEFAULT_ADMIN_USERNAME,
      email: DEFAULT_ADMIN_USERNAME,
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  await prisma.admin.upsert({
    where: { userId: adminUser.id },
    update: { name: 'System Administrator' },
    create: {
      userId: adminUser.id,
      name: 'System Administrator',
    },
  });
  console.log(`✓ Admin user verified: ${adminUser.username} (Password: hashed)`);

  // 4. Upsert 60 Students (SARA-001 to SARA-060)
  let studentCount = 0;
  for (let i = 1; i <= 60; i++) {
    const paddedIndex = String(i).padStart(3, '0');
    const studentId = `SARA-${paddedIndex}`;
    const fullName = `Student ${paddedIndex}`;
    const username = studentId;

    const user = await prisma.user.upsert({
      where: { username },
      update: {
        passwordHash: studentPasswordHash,
        role: UserRole.STUDENT,
        isActive: true,
      },
      create: {
        username,
        email: `${studentId.toLowerCase()}@sara.edu`,
        passwordHash: studentPasswordHash,
        role: UserRole.STUDENT,
        isActive: true,
      },
    });

    await prisma.student.upsert({
      where: { studentId },
      update: {
        fullName,
        batchNumber: BATCH_NUMBER,
        batchId: batch.id,
        status: 'ACTIVE',
      },
      create: {
        userId: user.id,
        studentId,
        fullName,
        batchNumber: BATCH_NUMBER,
        batchId: batch.id,
        status: 'ACTIVE',
      },
    });
    studentCount++;
  }
  console.log(`✓ Seeded ${studentCount} students (SARA-001 .. SARA-060, Password: hashed)`);

  // 5. Upsert Event
  const eventName = 'Coding Challenge 2026';
  const event = await prisma.event.upsert({
    where: { id: 'coding-challenge-2026-event-id' },
    update: {
      name: eventName,
      description: 'Official Coding Event Platform Competition 2026',
      status: EventStatus.DRAFT,
    },
    create: {
      id: 'coding-challenge-2026-event-id',
      name: eventName,
      description: 'Official Coding Event Platform Competition 2026',
      status: EventStatus.DRAFT,
    },
  });
  console.log(`✓ Event verified: ${event.name} (${event.status})`);

  // 6. Upsert Event Settings & Visibility Settings
  await prisma.eventSettings.upsert({
    where: { eventId: event.id },
    update: {
      maximumViolations: 3,
      singleSession: true,
    },
    create: {
      eventId: event.id,
      maximumViolations: 3,
      singleSession: true,
    },
  });

  await prisma.visibilitySettings.upsert({
    where: { eventId: event.id },
    update: {
      showAnswers: false,
      showResults: false,
    },
    create: {
      eventId: event.id,
      showAnswers: false,
      showResults: false,
    },
  });
  console.log(`✓ Event settings & visibility settings initialized (maxViolations: 3, showAnswers: false, showResults: false)`);

  // 7. Upsert 3 Initial Rounds
  const roundsConfig = [
    {
      order: 1,
      name: 'ROUND 1 — Tech Quiz + Output Prediction',
      type: RoundType.MCQ,
      duration: 20, // 20 minutes
      maximumMarks: 100,
      description: 'Multiple choice questions and output prediction challenges.',
    },
    {
      order: 2,
      name: 'ROUND 2 — Bug Hunt',
      type: RoundType.DEBUGGING,
      duration: 25, // 25 minutes
      maximumMarks: 100,
      description: 'Identify and repair bugs in provided source code.',
    },
    {
      order: 3,
      name: 'ROUND 3 — Code Sprint',
      type: RoundType.PROGRAMMING,
      duration: 40, // 40 minutes
      maximumMarks: 100,
      description: 'Solve algorithmic programming problems against hidden test cases.',
    },
  ];

  for (const r of roundsConfig) {
    const round = await prisma.round.upsert({
      where: {
        eventId_order: {
          eventId: event.id,
          order: r.order,
        },
      },
      update: {
        name: r.name,
        type: r.type,
        duration: r.duration,
        maximumMarks: r.maximumMarks,
        description: r.description,
        status: RoundStatus.DRAFT,
      },
      create: {
        eventId: event.id,
        order: r.order,
        name: r.name,
        type: r.type,
        duration: r.duration,
        maximumMarks: r.maximumMarks,
        description: r.description,
        status: RoundStatus.DRAFT,
      },
    });
    console.log(`✓ Round ${round.order} verified: ${round.name} (${round.type}, ${round.duration} mins)`);
  }

  console.log('Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Database seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
