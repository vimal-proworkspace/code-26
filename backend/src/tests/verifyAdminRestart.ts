import { adminRoundService } from '../services/adminRound.service';
import { query, queryOne, execute, closePool } from '../config/database';
import { DbAuditLog } from '../config/types';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ name, passed: true, details: 'OK' });
    console.log(`  ✅ ${name}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    results.push({ name, passed: false, details: msg });
    console.log(`  ❌ ${name}: ${msg}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function main() {
  console.log('\n========================================');
  console.log('Safe Admin Round Restart Verification');
  console.log('========================================\n');

  let round1Id = '';

  await runTest('Identify Round 1 and prepare test state', async () => {
    const { rounds } = await adminRoundService.getRounds();
    const r1 = rounds.find((r) => r.order === 1);
    assert(!!r1, 'Round 1 must exist');
    round1Id = r1!.id;

    // Reset status to DRAFT for clean testing
    await execute(
      `UPDATE rounds SET status = 'DRAFT', "remainingSeconds" = NULL, "startTime" = NULL, "endTime" = NULL, "isEnabled" = true WHERE id = $1`,
      [round1Id]
    );
  });

  // 1. Restart LIVE Round
  console.log('--- Restart LIVE Round Tests ---');

  let oldStartTimeMs = 0;

  await runTest('Start Round 1 (LIVE)', async () => {
    const started = await adminRoundService.startRound(round1Id);
    assert(started.status === 'LIVE', `Expected LIVE status, got ${started.status}`);
    assert(!!started.startTime && !!started.endTime, 'Server timing must be set');
    oldStartTimeMs = new Date(started.startTime!).getTime();
  });

  await runTest('Restart LIVE Round 1 (Clears timing & sets status to READY)', async () => {
    const restarted = await adminRoundService.restartRound(round1Id, 'Accidentally started round');
    assert(restarted.status === 'READY', `Expected status READY, got ${restarted.status}`);
    assert(restarted.startTime === null, 'startTime must be reset to null');
    assert(restarted.endTime === null, 'endTime must be reset to null');
    assert(restarted.remainingSeconds === null, 'remainingSeconds must be reset to null');
  });

  await runTest('Verify Audit Log for ROUND_RESTARTED', async () => {
    const log = await queryOne<DbAuditLog>(
      `SELECT * FROM audit_logs WHERE entity = 'Round' AND "entityId" = $1 AND action = 'ROUND_RESTARTED' ORDER BY "createdAt" DESC LIMIT 1`,
      [round1Id]
    );

    assert(!!log, 'ROUND_RESTARTED audit log entry must exist');
    const metadata = typeof log!.metadata === 'string' ? JSON.parse(log!.metadata) : log!.metadata;
    assert(metadata.previousStatus === 'LIVE', `Expected previousStatus LIVE, got ${metadata.previousStatus}`);
    assert(metadata.newStatus === 'READY', `Expected newStatus READY, got ${metadata.newStatus}`);
    assert(metadata.reason === 'Accidentally started round', `Expected reason, got ${metadata.reason}`);
  });

  await runTest('Re-starting Round 1 generates NEW server timing', async () => {
    await new Promise((res) => setTimeout(res, 100));

    const reStarted = await adminRoundService.startRound(round1Id);
    assert(reStarted.status === 'LIVE', `Expected status LIVE, got ${reStarted.status}`);
    assert(!!reStarted.startTime && !!reStarted.endTime, 'New server timing must be set');

    const newStartMs = new Date(reStarted.startTime!).getTime();
    assert(newStartMs >= oldStartTimeMs, 'New start time must be equal or later than old start time');
  });

  // 2. Restart PAUSED Round
  console.log('\n--- Restart PAUSED Round Tests ---');

  await runTest('Pause Round 1', async () => {
    const paused = await adminRoundService.pauseRound(round1Id);
    assert(paused.status === 'PAUSED', `Expected PAUSED status, got ${paused.status}`);
  });

  await runTest('Restart PAUSED Round 1', async () => {
    const restarted = await adminRoundService.restartRound(round1Id, 'Restarting from pause');
    assert(restarted.status === 'READY', `Expected READY status, got ${restarted.status}`);
    assert(restarted.remainingSeconds === null, 'remainingSeconds must be cleared');
  });

  // 3. Edge Case Validation
  console.log('\n--- Edge Case Validation ---');

  await runTest('DRAFT Round restart rejected', async () => {
    await execute(`UPDATE rounds SET status = 'DRAFT' WHERE id = $1`, [round1Id]);
    try {
      await adminRoundService.restartRound(round1Id);
      throw new Error('Should have rejected restarting a DRAFT round');
    } catch (err: any) {
      assert(err.statusCode === 400, `Expected status 400, got ${err.statusCode}`);
    }
  });

  // Reset database state to DRAFT
  await execute(
    `UPDATE rounds SET status = 'DRAFT', "remainingSeconds" = NULL, "startTime" = NULL, "endTime" = NULL WHERE id = $1`,
    [round1Id]
  );

  // ============ SUMMARY ============
  console.log('\n========================================');
  console.log('VERIFICATION SUMMARY');
  console.log('========================================');

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log(`\nTotal: ${total}  Passed: ${passed}  Failed: ${failed}`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`  ❌ ${r.name}: ${r.details}`);
    }
  }

  console.log(`\nOverall: ${failed === 0 ? '✅ ALL PASSED' : '❌ SOME FAILED'}`);
  await closePool();
  process.exit(failed > 0 ? 1 : 0);
}

main();
