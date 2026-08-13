import '../config/env';
import { pool } from '../config/db';

async function main() {
  const samples: Record<string, string> = {
    users: `SELECT id, role, username, "studentId", "isActive" FROM users LIMIT 3`,
    students: `SELECT s.*, b.code as batch_code FROM students s JOIN batches b ON b.id = s."batchId" LIMIT 3`,
    rounds: `SELECT * FROM rounds ORDER BY "orderNo"`,
    events: `SELECT * FROM events`,
    event_settings: `SELECT * FROM event_settings`,
    questions: `SELECT * FROM questions LIMIT 2`,
    sessions: `SELECT id, "userId", "tokenJti", "isRevoked", "expiresAt" FROM sessions LIMIT 2`,
    admins: `SELECT * FROM admins LIMIT 1`,
    debugging_problems: `SELECT * FROM debugging_problems LIMIT 1`,
    programming_problems: `SELECT * FROM programming_problems LIMIT 1`,
    violations: `SELECT * FROM violations LIMIT 2`,
  };

  for (const [name, sql] of Object.entries(samples)) {
    try {
      const res = await pool.query(sql);
      console.log(`\n=== ${name} ===`);
      console.log(JSON.stringify(res.rows, null, 2));
    } catch (e: any) {
      console.log(`\n=== ${name} ERROR ===`, e.message);
    }
  }

  const enums = await pool.query(`
    SELECT t.typname, e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    ORDER BY t.typname, e.enumsortorder
  `);
  console.log('\n=== ENUMS ===');
  const grouped: Record<string, string[]> = {};
  for (const row of enums.rows) {
    if (!grouped[row.typname]) grouped[row.typname] = [];
    grouped[row.typname].push(row.enumlabel);
  }
  console.log(JSON.stringify(grouped, null, 2));

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
