/**
 * Verification Test Script for Step 9: Safe Admin Round Restart / Reset
 *
 * Usage: npx ts-node src/tests/verifyAdminRestart.ts
 */

import { adminRoundService } from '../services/adminRound.service';
import { prisma } from '../config/database';
import { RoundStatus } from '@prisma/client';

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
    await prisma.round.update({
      where: { id: round1Id },
      data: { status: RoundStatus.DRAFT, remainingSeconds: null, startTime: null, endTime: null, isEnabled: true },
    });
  });

  // 1. Restart LIVE Round
  console.log('--- Restart LIVE Round Tests ---');

  let oldStartTimeMs = 0;
  let oldEndTimeMs = 0;

  await runTest('Start Round 1 (LIVE)', async () => {
    const started = await adminRoundService.startRound(round1Id);
    assert(started.status === RoundStatus.LIVE, `Expected LIVE status, got ${started.status}`);
    assert(!!started.startTime && !!started.endTime, 'Server timing must be set');
    oldStartTimeMs = started.startTime!.getTime();
    oldEndTimeMs = started.endTime!.getTime();
  });

  await runTest('Restart LIVE Round 1 (Clears timing & sets status to READY)', async () => {
    const restarted = await adminRoundService.restartRound(round1Id, 'Accidentally started round');
    assert(restarted.status === RoundStatus.READY, `Expected status READY, got ${restarted.status}`);
    assert(restarted.startTime === null, 'startTime must be reset to null');
    assert(restarted.endTime === null, 'endTime must be reset to null');
    assert(restarted.remainingSeconds === null, 'remainingSeconds must be reset to null');
  });

  await runTest('Verify Audit Log for ROUND_RESTARTED', async () => {
    const log = await prisma.auditLog.findFirst({
      where: {
        entity: 'Round',
        entityId: round1Id,
        action: 'ROUND_RESTARTED',
      },
      orderBy: { createdAt: 'desc' },
    });

    assert(!!log, 'ROUND_RESTARTED audit log entry must exist');
    const metadata = log!.metadata as any;
    assert(metadata.previousStatus === 'LIVE', `Expected previousStatus LIVE, got ${metadata.previousStatus}`);
    assert(metadata.newStatus === 'READY', `Expected newStatus READY, got ${metadata.newStatus}`);
    assert(metadata.reason === 'Accidentally started round', `Expected reason, got ${metadata.reason}`);
  });

  await runTest('Re-starting Round 1 generates NEW server timing', async () => {
    // Wait brief moment to guarantee new timestamp
    await new Promise((res) => setTimeout(res, 100));

    const reStarted = await adminRoundService.startRound(round1Id);
    assert(reStarted.status === RoundStatus.LIVE, `Expected status LIVE, got ${reStarted.status}`);
    assert(!!reStarted.startTime && !!reStarted.endTime, 'New server timing must be set');

    const newStartMs = reStarted.startTime!.getTime();
    assert(newStartMs >= oldStartTimeMs, 'New start time must be equal or later than old start time');
  });

  // 2. Restart PAUSED Round
  console.log('\n--- Restart PAUSED Round Tests ---');

  await runTest('Pause Round 1', async () => {
    const paused = await adminRoundService.pauseRound(round1Id);
    assert(paused.status === RoundStatus.PAUSED, `Expected PAUSED status, got ${paused.status}`);
  });

  await runTest('Restart PAUSED Round 1', async () => {
    const restarted = await adminRoundService.restartRound(round1Id, 'Restarting from pause');
    assert(restarted.status === RoundStatus.READY, `Expected READY status, got ${restarted.status}`);
    assert(restarted.remainingSeconds === null, 'remainingSeconds must be cleared');
  });

  // 3. Edge Case Validation
  console.log('\n--- Edge Case Validation ---');

  await runTest('DRAFT Round restart rejected', async () => {
    await prisma.round.update({ where: { id: round1Id }, data: { status: RoundStatus.DRAFT } });
    try {
      await adminRoundService.restartRound(round1Id);
      throw new Error('Should have rejected restarting a DRAFT round');
    } catch (err: any) {
      assert(err.statusCode === 400, `Expected status 400, got ${err.statusCode}`);
    }
  });

  // Reset database state to DRAFT
  await prisma.round.update({
    where: { id: round1Id },
    data: { status: RoundStatus.DRAFT, remainingSeconds: null, startTime: null, endTime: null },
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
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main();
