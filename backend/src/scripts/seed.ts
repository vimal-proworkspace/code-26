import bcrypt from 'bcrypt';
import { pool, query, queryOne, transaction } from '../config/db';
import { config } from '../config/env';

const SALT_ROUNDS = 10;
const DEFAULT_ADMIN_USERNAME = config.defaultAdminUsername || 'admin@it.com';
const DEFAULT_ADMIN_PASSWORD = config.defaultAdminPassword || 'admin@it';
const DEFAULT_STUDENT_PASSWORD = config.defaultStudentPassword || 'welcome@sara';
const BATCH_NUMBER = '284001';

async function main() {
  console.log('Starting Coding Event Platform 2026 Database Seed (pg)...');

  const adminPasswordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, SALT_ROUNDS);
  const studentPasswordHash = await bcrypt.hash(DEFAULT_STUDENT_PASSWORD, SALT_ROUNDS);

  // 1. Batch
  let batch = await queryOne<{ id: string }>(
    `SELECT id FROM batches WHERE "batchNumber" = $1`,
    [BATCH_NUMBER]
  );
  if (!batch) {
    batch = await queryOne<{ id: string }>(
      `INSERT INTO batches (id, "batchNumber", name, description, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, 'Initial Student Batch 2026', NOW(), NOW())
       RETURNING id`,
      [BATCH_NUMBER, `Batch ${BATCH_NUMBER}`]
    );
  }
  console.log(`✓ Batch verified: ${BATCH_NUMBER}`);

  // 2. Admin User & Admin Record
  let adminUser = await queryOne<{ id: string }>(
    `SELECT id FROM users WHERE username = $1`,
    [DEFAULT_ADMIN_USERNAME]
  );
  if (!adminUser) {
    adminUser = await queryOne<{ id: string }>(
      `INSERT INTO users (id, username, email, "passwordHash", role, "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $1, $2, 'ADMIN', true, NOW(), NOW())
       RETURNING id`,
      [DEFAULT_ADMIN_USERNAME, adminPasswordHash]
    );
  } else {
    await query(
      `UPDATE users SET "passwordHash" = $1, role = 'ADMIN', "isActive" = true WHERE id = $2`,
      [adminPasswordHash, adminUser.id]
    );
  }

  if (adminUser) {
    const adminRec = await queryOne<{ id: string }>(
      `SELECT id FROM admins WHERE "userId" = $1`,
      [adminUser.id]
    );
    if (!adminRec) {
      await query(
        `INSERT INTO admins (id, "userId", name, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, 'System Administrator', NOW(), NOW())`,
        [adminUser.id]
      );
    }
  }
  console.log(`✓ Admin user verified: ${DEFAULT_ADMIN_USERNAME}`);

  // 3. Students SARA-001 to SARA-060
  let studentCount = 0;
  for (let i = 1; i <= 60; i++) {
    const paddedIndex = String(i).padStart(3, '0');
    const studentId = `SARA-${paddedIndex}`;
    const fullName = `Student ${paddedIndex}`;
    const username = studentId;

    let user = await queryOne<{ id: string }>(
      `SELECT id FROM users WHERE username = $1`,
      [username]
    );
    if (!user) {
      user = await queryOne<{ id: string }>(
        `INSERT INTO users (id, username, email, "passwordHash", role, "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, 'STUDENT', true, NOW(), NOW())
         RETURNING id`,
        [username, `${studentId.toLowerCase()}@sara.edu`, studentPasswordHash]
      );
    } else {
      await query(
        `UPDATE users SET "passwordHash" = $1, role = 'STUDENT', "isActive" = true WHERE id = $2`,
        [studentPasswordHash, user.id]
      );
    }

    if (user && batch) {
      const studentRec = await queryOne<{ id: string }>(
        `SELECT id FROM students WHERE "studentId" = $1`,
        [studentId]
      );
      if (!studentRec) {
        await query(
          `INSERT INTO students (id, "userId", "studentId", "fullName", "batchNumber", "batchId", status, "createdAt", "updatedAt")
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'ACTIVE', NOW(), NOW())`,
          [user.id, studentId, fullName, BATCH_NUMBER, batch.id]
        );
      }
    }
    studentCount++;
  }
  console.log(`✓ Seeded ${studentCount} students (SARA-001 .. SARA-060)`);

  // 4. Event
  const eventId = 'coding-challenge-2026-event-id';
  let event = await queryOne<{ id: string }>(
    `SELECT id FROM events WHERE id = $1`,
    [eventId]
  );
  if (!event) {
    event = await queryOne<{ id: string }>(
      `INSERT INTO events (id, name, description, status, "createdAt", "updatedAt")
       VALUES ($1, 'Coding Challenge 2026', 'Official Coding Event Platform Competition 2026', 'DRAFT', NOW(), NOW())
       RETURNING id`,
      [eventId]
    );
  }

  if (event) {
    // Event settings
    const evtSettings = await queryOne<{ id: string }>(
      `SELECT id FROM event_settings WHERE "eventId" = $1`,
      [event.id]
    );
    if (!evtSettings) {
      await query(
        `INSERT INTO event_settings (id, "eventId", "maximumViolations", "singleSession", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, 3, true, NOW(), NOW())`,
        [event.id]
      );
    }

    // Visibility settings
    const visSettings = await queryOne<{ id: string }>(
      `SELECT id FROM visibility_settings WHERE "eventId" = $1`,
      [event.id]
    );
    if (!visSettings) {
      await query(
        `INSERT INTO visibility_settings (id, "eventId", "showAnswers", "showResults", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, false, false, NOW(), NOW())`,
        [event.id]
      );
    }
  }

  // 5. Rounds
  const roundsConfig = [
    {
      order: 1,
      name: 'ROUND 1 — Tech Quiz + Output Prediction',
      type: 'MCQ',
      duration: 20,
      maximumMarks: 100,
      description: 'Multiple choice questions and output prediction challenges.',
    },
    {
      order: 2,
      name: 'ROUND 2 — Bug Hunt',
      type: 'DEBUGGING',
      duration: 25,
      maximumMarks: 100,
      description: 'Identify and repair bugs in provided source code.',
    },
    {
      order: 3,
      name: 'ROUND 3 — Code Sprint',
      type: 'PROGRAMMING',
      duration: 40,
      maximumMarks: 100,
      description: 'Solve algorithmic programming problems against hidden test cases.',
    },
  ];

  for (const r of roundsConfig) {
    const existingRound = await queryOne<{ id: string }>(
      `SELECT id FROM rounds WHERE "eventId" = $1 AND "order" = $2`,
      [eventId, r.order]
    );

    if (!existingRound) {
      await query(
        `INSERT INTO rounds (id, "eventId", name, type, description, "order", duration, "maximumMarks", status, "isEnabled", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, 'DRAFT', true, NOW(), NOW())`,
        [eventId, r.name, r.type, r.description, r.order, r.duration, r.maximumMarks]
      );
    }
    console.log(`✓ Round ${r.order} verified: ${r.name}`);
  }

  console.log('Database seed (pg) completed successfully!');
}

main()
  .catch((e) => {
    console.error('Database seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
