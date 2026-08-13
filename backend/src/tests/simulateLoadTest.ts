import { query, queryOne, closePool } from '../config/database';
import { createApp } from '../app';
import request from 'supertest';
import { DbStudent, DbUser } from '../config/types';
import { signAuthToken, AUTH_COOKIE_NAME } from '../utils/jwt';

async function runLoadSimulation(clientCount: number) {
  console.log(`\n--- Starting Load Simulation: ${clientCount} Concurrent Students ---`);
  const app = createApp();

  const students = await query<DbStudent & { username: string }>(
    `SELECT s.*, u.username FROM students s JOIN users u ON u.id = s."userId" LIMIT $1`,
    [clientCount]
  );

  if (students.length === 0) {
    throw new Error('No student accounts available for load testing');
  }

  const startTime = Date.now();
  let successCount = 0;
  let errorCount = 0;
  const latencies: number[] = [];

  console.log(`Simulating ${students.length} concurrent authenticated HTTP requests & status lookups...`);

  const promises = students.map(async (st) => {
    // Create session in DB for authentic request
    const session = await queryOne<{ id: string }>(
      `INSERT INTO sessions (id, "userId", "sessionToken", "createdAt", "expiresAt", "lastSeenAt")
       VALUES (gen_random_uuid(), $1, gen_random_uuid(), NOW(), NOW() + INTERVAL '1 hour', NOW())
       RETURNING id`,
      [st.userId]
    );

    if (!session) return;

    const token = signAuthToken({
      userId: st.userId,
      role: 'STUDENT',
      sessionId: session.id,
      studentId: st.studentId,
    });

    const reqStart = Date.now();
    try {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [`${AUTH_COOKIE_NAME}=${token}`]);

      const reqTime = Date.now() - reqStart;
      latencies.push(reqTime);

      if (res.status === 200) {
        successCount++;
      } else {
        errorCount++;
      }
    } catch {
      errorCount++;
    }
  });

  await Promise.all(promises);

  const totalTimeMs = Date.now() - startTime;
  const avgLatencyMs = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  const maxLatencyMs = latencies.length > 0 ? Math.max(...latencies) : 0;

  console.log(`Results for ${clientCount} Clients:`);
  console.log(`- Total Duration: ${totalTimeMs} ms`);
  console.log(`- Successes: ${successCount} / ${students.length}`);
  console.log(`- Failures: ${errorCount}`);
  console.log(`- Avg Latency: ${avgLatencyMs} ms`);
  console.log(`- Max Latency: ${maxLatencyMs} ms`);

  return {
    clientCount: students.length,
    totalTimeMs,
    successCount,
    errorCount,
    avgLatencyMs,
    maxLatencyMs,
  };
}

async function main() {
  console.log('====================================================');
  console.log('STARTING CONCURRENCY & LOAD TESTING SIMULATION');
  console.log('====================================================');

  try {
    const report60 = await runLoadSimulation(60);
    const report100 = await runLoadSimulation(100);

    console.log('\n====================================================');
    console.log('LOAD SIMULATION COMPLETED SUCCESSFULLY');
    console.log('====================================================');
    console.log(`60 Clients: ${report60.successCount}/${report60.clientCount} passed (Avg ${report60.avgLatencyMs}ms)`);
    console.log(`100 Clients: ${report100.successCount}/${report100.clientCount} passed (Avg ${report100.avgLatencyMs}ms)`);
  } catch (err) {
    console.error('Load simulation error:', err);
    process.exit(1);
  } finally {
    await closePool();
  }
}

main().then(() => process.exit(0));
