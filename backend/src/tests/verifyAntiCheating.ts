import { prisma } from '../config/database';
import { adminRoundService } from '../services/adminRound.service';
import { violationService } from '../services/violation.service';
import { round1Service } from '../services/round1.service';
import { round2Service } from '../services/round2.service';
import { round3Service } from '../services/round3.service';
import { ViolationType, RoundStatus, RoundProgressStatus } from '@prisma/client';

async function runVerification() {
  console.log('=== STARTING ANTI-CHEATING & VIOLATION MANAGEMENT VERIFICATION ===\n');

  try {
    // Fetch Event & Round 1
    const event = await prisma.event.findFirst();
    if (!event) throw new Error('Primary Event not found. Run db seed first.');

    const round1 = await prisma.round.findFirst({
      where: { eventId: event.id, order: 1 },
    });
    if (!round1) throw new Error('Round 1 not found.');

    // Fetch Student SARA-001
    const student = await prisma.student.findFirst({
      where: { studentId: 'SARA-001' },
      include: { user: true },
    });
    if (!student || !student.userId) throw new Error('Test Student SARA-001 not found.');

    // Reset Round 1 state to READY and clear existing violations for clean test
    await prisma.violation.deleteMany({ where: { studentId: student.id } });
    await prisma.roundProgress.deleteMany({ where: { studentId: student.id } });
    await prisma.round.update({
      where: { id: round1.id },
      data: { status: RoundStatus.READY, startTime: null, endTime: null },
    });

    console.log('✓ Database state reset to READY for SARA-001 anti-cheating test.');

    // 1. Test Monitoring Scoping (Violation while READY is ignored)
    const readyRes = await violationService.recordViolation(student.userId, {
      violationType: ViolationType.FULLSCREEN_EXIT,
    });
    if (readyRes.counted) {
      throw new Error('SECURITY VIOLATION: Anti-cheating recorded a violation during READY round!');
    }
    console.log('✓ Monitoring scoping verified: Violation attempt during READY round was safely ignored.');

    // 2. Admin Starts Round 1 -> Status turns LIVE
    await adminRoundService.startRound(round1.id);
    const liveRound = await prisma.round.findUnique({ where: { id: round1.id } });
    if (liveRound?.status !== RoundStatus.LIVE) throw new Error('Round 1 failed to transition to LIVE!');
    console.log('✓ Admin started Round 1. Status = LIVE.');

    // 3. Record Valid Violation #1 during LIVE
    const v1 = await violationService.recordViolation(student.userId, {
      violationType: ViolationType.FULLSCREEN_EXIT,
      details: 'Test Fullscreen Exit 1',
    });
    if (!v1.counted || v1.violationCount !== 1 || v1.isLocked) {
      throw new Error(`Violation 1 failed! Counted: ${v1.counted}, Count: ${v1.violationCount}`);
    }
    console.log('✓ Violation #1 persisted during LIVE round. Total Count = 1, isLocked = false.');

    // 4. Test 2-Second Deduplication (Immediate duplicate violation within < 2s is deduplicated)
    const dedupRes = await violationService.recordViolation(student.userId, {
      violationType: ViolationType.FULLSCREEN_EXIT,
      details: 'Duplicate Fullscreen Exit immediately after',
    });
    if (dedupRes.counted || dedupRes.violationCount !== 1) {
      throw new Error('Deduplication failed: Immediate duplicate violation was not deduplicated!');
    }
    console.log('✓ Deduplication verified: Event storm within 2-second window was deduplicated safely.');

    // Wait 2.1s so deduplication window expires for next test
    await new Promise((resolve) => setTimeout(resolve, 2100));

    // 5. Record Violation #2
    const v2 = await violationService.recordViolation(student.userId, {
      violationType: ViolationType.TAB_SWITCH,
      details: 'Test Tab Switch 2',
    });
    if (!v2.counted || v2.violationCount !== 2 || v2.isLocked) {
      throw new Error(`Violation 2 failed! Counted: ${v2.counted}, Count: ${v2.violationCount}`);
    }
    console.log('✓ Violation #2 persisted. Total Count = 2, isLocked = false.');

    await new Promise((resolve) => setTimeout(resolve, 2100));

    // 6. Record Violation #3 (Reaching maximumViolations = 3) -> Triggers LOCK
    const v3 = await violationService.recordViolation(student.userId, {
      violationType: ViolationType.WINDOW_BLUR,
      details: 'Test Window Blur 3',
    });
    if (!v3.counted || v3.violationCount !== 3 || !v3.isLocked) {
      throw new Error(`Violation 3 failed! Counted: ${v3.counted}, Count: ${v3.violationCount}, isLocked: ${v3.isLocked}`);
    }

    const progress = await prisma.roundProgress.findUnique({
      where: { studentId_roundId: { studentId: student.id, roundId: round1.id } },
    });
    if (progress?.status !== RoundProgressStatus.LOCKED) {
      throw new Error('RoundProgress failed to transition to LOCKED!');
    }
    console.log('✓ Violation #3 reached threshold (3/3). Student interface set to LOCKED!');

    // 7. Test Locked Student Backend Enforcement (Saving answers/code while locked MUST be blocked with 403)
    let lockSaveBlocked = false;
    try {
      await round1Service.saveStudentAnswer(round1.id, student.id, 'dummy_q_id', 'A');
    } catch (err: any) {
      lockSaveBlocked = err.statusCode === 403;
      console.log(`✓ Locked student block verified: Quiz save rejected (${err.message}).`);
    }
    if (!lockSaveBlocked) throw new Error('SECURITY VIOLATION: Locked student was able to save quiz answer!');

    let lockSubmitBlocked = false;
    try {
      await round1Service.submitStudentRound1(round1.id, student.id);
    } catch (err: any) {
      lockSubmitBlocked = err.statusCode === 403;
      console.log(`✓ Locked student block verified: Quiz submit rejected (${err.message}).`);
    }
    if (!lockSubmitBlocked) throw new Error('SECURITY VIOLATION: Locked student was able to submit quiz!');

    // 8. Test Invigilator Continuation Password Validation
    let wrongPasswordBlocked = false;
    try {
      await violationService.invigilatorUnlock(student.userId, 'wrongpassword123');
    } catch (err: any) {
      wrongPasswordBlocked = err.statusCode === 401;
      console.log(`✓ Invigilator password protection verified: Wrong password rejected (${err.message}).`);
    }
    if (!wrongPasswordBlocked) throw new Error('SECURITY VIOLATION: Invalid invigilator password was accepted!');

    // 9. Correct Invigilator Continuation Unlock
    const startDeadlineBefore = liveRound.endTime?.getTime();
    const unlockRes = await violationService.invigilatorUnlock(student.userId, 'admin@sara');
    if (!unlockRes.success) throw new Error('Valid invigilator unlock failed!');

    const unlockedProgress = await prisma.roundProgress.findUnique({
      where: { studentId_roundId: { studentId: student.id, roundId: round1.id } },
    });
    if (unlockedProgress?.status !== RoundProgressStatus.IN_PROGRESS) {
      throw new Error('RoundProgress failed to unlock to IN_PROGRESS!');
    }

    const countAfterUnlock = await prisma.violation.count({
      where: { studentId: student.id, roundId: round1.id },
    });
    if (countAfterUnlock !== 3) {
      throw new Error('Unlocking student erroneously deleted recorded violations!');
    }

    const startDeadlineAfter = (await prisma.round.findUnique({ where: { id: round1.id } }))?.endTime?.getTime();
    if (startDeadlineBefore !== startDeadlineAfter) {
      throw new Error('CRITICAL TIMER SAFETY VIOLATION: Invigilator unlock modified official competition deadline!');
    }
    console.log('✓ Invigilator continuation unlock successful. Lock cleared, violations preserved (3/3), deadline unchanged (NO EXTRA TIME).');

    // 10. Test Admin Pause Safety
    await adminRoundService.pauseRound(round1.id);
    const pauseRes = await violationService.recordViolation(student.userId, {
      violationType: ViolationType.FULLSCREEN_EXIT,
    });
    if (pauseRes.counted) {
      throw new Error('SECURITY VIOLATION: Violation was recorded during PAUSED round!');
    }
    console.log('✓ Pause safety verified: Fullscreen exit during PAUSED round was not counted as a violation.');

    // 11. Admin Resumes & Ends Round
    await adminRoundService.resumeRound(round1.id);
    await adminRoundService.endRound(round1.id);

    const endedRes = await violationService.recordViolation(student.userId, {
      violationType: ViolationType.TAB_SWITCH,
    });
    if (endedRes.counted) {
      throw new Error('SECURITY VIOLATION: Violation recorded after round ENDED!');
    }
    console.log('✓ Round End monitoring stop verified: Violation attempt after ENDED round was ignored.');

    // 12. Verify Admin Overview API
    const overview = await violationService.getAdminViolationOverview();
    if (!overview || overview.totalViolations === 0) {
      throw new Error('Admin violation overview failed to retrieve recorded violations!');
    }
    console.log(`✓ Admin Security Overview verified: Total recorded violations = ${overview.totalViolations}`);

    console.log('\n=== ANTI-CHEATING & VIOLATION MANAGEMENT VERIFICATION SUCCESSFUL (ALL TESTS PASSED) ===');
  } catch (err: any) {
    console.error('❌ VERIFICATION FAILED:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runVerification();
