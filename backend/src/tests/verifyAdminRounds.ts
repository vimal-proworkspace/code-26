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
  console.log('Admin Event & Round Control Verification');
  console.log('========================================\n');

  // 1. Get Rounds
  console.log('--- Round Retrieval & Ordering Tests ---');

  await runTest('Get Rounds (Sorted by Order)', async () => {
    const { event, rounds } = await adminRoundService.getRounds();
    assert(!!event, 'Event must exist');
    assert(rounds.length >= 3, `Expected at least 3 rounds, got ${rounds.length}`);

    for (let i = 0; i < rounds.length - 1; i++) {
      assert(rounds[i].order <= rounds[i + 1].order, `Rounds must be ordered ascending: #${rounds[i].order} > #${rounds[i + 1].order}`);
    }
  });

  // 2. Round CRUD
  console.log('\n--- Round CRUD Operations ---');

  let createdRoundId = '';
  await runTest('Create New Round', async () => {
    const round = await adminRoundService.createRound({
      name: 'ROUND 4 — Final Challenge',
      type: 'PROGRAMMING',
      description: 'Test extra round',
      duration: 60,
      maximumMarks: 200,
    });

    assert(!!round.id, 'Created round must have ID');
    assert(round.name === 'ROUND 4 — Final Challenge', 'Name must match');
    assert(round.status === 'DRAFT', 'New round must start in DRAFT status');
    createdRoundId = round.id;
  });

  await runTest('Update Round Description', async () => {
    assert(!!createdRoundId, 'Created round ID required');
    const updated = await adminRoundService.updateRound(createdRoundId, {
      description: 'Updated description for test round',
    });
    assert(updated.description === 'Updated description for test round', 'Description should be updated');
  });

  await runTest('Toggle Round Enabled/Disabled', async () => {
    assert(!!createdRoundId, 'Created round ID required');
    const disabled = await adminRoundService.toggleRoundEnabled(createdRoundId, false);
    assert(disabled.isEnabled === false, 'Round should be disabled');

    const enabled = await adminRoundService.toggleRoundEnabled(createdRoundId, true);
    assert(enabled.isEnabled === true, 'Round should be re-enabled');
  });

  // 3. State Transitions & Timing Rules
  console.log('\n--- Round State Transition & Server Timing Tests ---');

  let round1Id = '';
  let round2Id = '';

  await runTest('Identify Round 1 and Round 2', async () => {
    const { rounds } = await adminRoundService.getRounds();
    const r1 = rounds.find((r) => r.order === 1);
    const r2 = rounds.find((r) => r.order === 2);

    assert(!!r1, 'Round 1 must exist');
    assert(!!r2, 'Round 2 must exist');
    round1Id = r1!.id;
    round2Id = r2!.id;

    // Reset status to DRAFT for clean testing if previously altered
    await execute(`UPDATE rounds SET status = 'DRAFT', "remainingSeconds" = NULL, "startTime" = NULL, "endTime" = NULL WHERE id = $1`, [round1Id]);
    await execute(`UPDATE rounds SET status = 'DRAFT', "remainingSeconds" = NULL, "startTime" = NULL, "endTime" = NULL WHERE id = $2`, [round2Id]);
  });

  await runTest('Sequential Rule: Cannot start Round 2 while Round 1 is DRAFT', async () => {
    try {
      await adminRoundService.startRound(round2Id);
      throw new Error('Should have rejected starting Round 2 before Round 1 is ENDED');
    } catch (err: any) {
      assert(err.statusCode === 400, `Expected status 400, got ${err.statusCode}`);
      assert(err.message.includes('ENDED'), `Expected ENDED rule message, got: ${err.message}`);
    }
  });

  await runTest('Start Round 1 (Server Timing & LIVE transition)', async () => {
    const started = await adminRoundService.startRound(round1Id);
    assert(started.status === 'LIVE', `Expected status LIVE, got ${started.status}`);
    assert(!!started.startTime, 'startTime must be set by server clock');
    assert(!!started.endTime, 'endTime must be calculated by server clock');

    const durationMs = new Date(started.endTime!).getTime() - new Date(started.startTime!).getTime();
    const durationMins = Math.round(durationMs / (60 * 1000));
    assert(durationMins === started.duration, `Expected duration ${started.duration} mins, calculated ${durationMins}`);
  });

  await runTest('Race Protection: Cannot start an already LIVE round', async () => {
    try {
      await adminRoundService.startRound(round1Id);
      throw new Error('Should have rejected double-start');
    } catch (err: any) {
      assert(err.statusCode === 400, `Expected status 400, got ${err.statusCode}`);
      assert(err.message.includes('LIVE'), `Expected LIVE error, got: ${err.message}`);
    }
  });

  await runTest('Pause Round 1 (Stores remaining time)', async () => {
    const paused = await adminRoundService.pauseRound(round1Id);
    assert(paused.status === 'PAUSED', `Expected PAUSED status, got ${paused.status}`);
    assert(paused.remainingSeconds !== null && paused.remainingSeconds !== undefined, 'remainingSeconds must be stored');
  });

  await runTest('Resume Round 1 (Recalculates deadline)', async () => {
    const resumed = await adminRoundService.resumeRound(round1Id);
    assert(resumed.status === 'LIVE', `Expected LIVE status, got ${resumed.status}`);
    assert(!!resumed.startTime, 'New startTime must be set');
    assert(!!resumed.endTime, 'New endTime must be set');
    assert(resumed.remainingSeconds === null, 'remainingSeconds must be cleared after resume');
  });

  await runTest('End Round 1 (Transitions to ENDED)', async () => {
    const ended = await adminRoundService.endRound(round1Id);
    assert(ended.status === 'ENDED', `Expected ENDED status, got ${ended.status}`);
  });

  await runTest('Sequential Rule: Start Round 2 after Round 1 is ENDED', async () => {
    const started = await adminRoundService.startRound(round2Id);
    assert(started.status === 'LIVE', `Expected Round 2 status LIVE, got ${started.status}`);

    await adminRoundService.endRound(round2Id);
  });

  // 4. Cleanup & Deletion
  console.log('\n--- Cleanup & Audit Log Verification ---');

  await runTest('Delete Round without student activity', async () => {
    assert(!!createdRoundId, 'Created round ID required');
    const res = await adminRoundService.deleteRound(createdRoundId);
    assert(res.message.includes('deleted'), 'Round should be deleted successfully');
  });

  await runTest('Verify Audit Logs in PostgreSQL', async () => {
    const logs = await query<DbAuditLog>(
      `SELECT * FROM audit_logs WHERE entity = 'Round' ORDER BY "createdAt" DESC LIMIT 10`
    );

    assert(logs.length > 0, 'Audit logs must exist for round operations');
    const actions = logs.map((l) => l.action);
    console.log('  Logged Actions:', actions.join(', '));

    assert(actions.includes('ROUND_STARTED'), 'Audit log should include ROUND_STARTED');
    assert(actions.includes('ROUND_PAUSED'), 'Audit log should include ROUND_PAUSED');
    assert(actions.includes('ROUND_RESUMED'), 'Audit log should include ROUND_RESUMED');
    assert(actions.includes('ROUND_ENDED'), 'Audit log should include ROUND_ENDED');
  });

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
