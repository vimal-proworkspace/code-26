import '../config/env';
import { pool } from '../config/db';

async function main() {
  const tables = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);
  console.log('=== TABLES ===');
  for (const row of tables.rows) {
    console.log(row.table_name);
  }

  for (const row of tables.rows) {
    const table = row.table_name;
    const cols = await pool.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [table]
    );
    console.log(`\n=== ${table} ===`);
    for (const c of cols.rows) {
      console.log(`  ${c.column_name}: ${c.data_type} ${c.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    }
  }

  const counts = await pool.query(`
    SELECT 'users' as tbl, count(*)::int as cnt FROM users
    UNION ALL SELECT 'students', count(*)::int FROM students
    UNION ALL SELECT 'batches', count(*)::int FROM batches
    UNION ALL SELECT 'rounds', count(*)::int FROM rounds
    UNION ALL SELECT 'events', count(*)::int FROM events
  `);
  console.log('\n=== ROW COUNTS ===');
  for (const r of counts.rows) {
    console.log(`${r.tbl}: ${r.cnt}`);
  }

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
