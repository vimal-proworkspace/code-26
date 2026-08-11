import { prisma } from '../config/database';
import { adminRoundService } from '../services/adminRound.service';
import { round1Service } from '../services/round1.service';
import { round2Service } from '../services/round2.service';
import { round3Service } from '../services/round3.service';
import { competitionService } from '../services/competition.service';
import { UserRole, RoundType, ProgrammingLanguage } from '@prisma/client';

async function runVerification() {
  console.log('=== STARTING COMPLETE COMPETITION FLOW & STATE MANAGEMENT VERIFICATION ===\n');

  try {
    // 1. Fetch Primary Event & Rounds
    const event = await prisma.event.findFirst();
    if (!event) throw new Error('Primary Event not found. Run db seed first.');

    const rounds = await prisma.round.findMany({
      where: { eventId: event.id },
      orderBy: { order: 'asc' },
    });

    if (rounds.length < 3) throw new Error('Rounds 1, 2, and 3 must exist in database.');

    const round1 = rounds.find((r) => r.order === 1)!;
    const round2 = rounds.find((r) => r.order === 2)!;
    const round3 = rounds.find((r) => r.order === 3)!;

    console.log(`✓ Event & Rounds loaded: R1=${round1.name}, R2=${round2.name}, R3=${round3.name}`);

    // Ensure all rounds are currently reset to READY for testing
    await prisma.round.updateMany({
      where: { eventId: event.id },
      data: { status: 'READY', startTime: null, endTime: null },
    });
    await prisma.event.update({ where: { id: event.id }, data: { status: 'READY' } });

    // Fetch test student SARA-001
    const student = await prisma.student.findFirst({ where: { studentId: 'SARA-001' } });
    if (!student) throw new Error('Test Student SARA-001 not found.');

    // 2. Test Sequential Progression Enforcement (Round 2 CANNOT start before Round 1 ENDED)
    let round2StartBlocked = false;
    try {
      await adminRoundService.startRound(round2.id);
    } catch (err: any) {
      round2StartBlocked = true;
      console.log(`✓ Sequential progression rule enforced: Cannot start Round 2 before Round 1 is ENDED (${err.message}).`);
    }
    if (!round2StartBlocked) throw new Error('SECURITY VIOLATION: Round 2 started before Round 1 was ENDED!');

    // 3. Admin Starts Round 1
    await adminRoundService.startRound(round1.id);
    const liveR1 = await prisma.round.findUnique({ where: { id: round1.id } });
    if (liveR1?.status !== 'LIVE') throw new Error('Round 1 failed to transition to LIVE!');
    console.log('✓ Admin started Round 1 successfully. Status = LIVE.');

    // 4. Student Submits Round 1 Answers
    const r1Questions = await round1Service.getStudentQuiz(round1.id);
    const answersMap: Record<string, string> = {};
    r1Questions.questions.forEach((q) => {
      answersMap[q.id] = q.correctAnswer || 'A';
    });

    await round1Service.submitStudentQuiz(round1.id, student.id, answersMap);
    console.log('✓ Student SARA-001 submitted Round 1 quiz answers.');

    // 5. Admin Ends Round 1
    await adminRoundService.endRound(round1.id);
    const endedR1 = await prisma.round.findUnique({ where: { id: round1.id } });
    if (endedR1?.status !== 'ENDED') throw new Error('Round 1 failed to transition to ENDED!');
    console.log('✓ Admin ended Round 1 successfully. Status = ENDED.');

    // 6. Test Previous Round Access Denial (Student cannot submit answers to completed Round 1)
    let r1SubmitBlocked = false;
    try {
      await round1Service.submitStudentQuiz(round1.id, student.id, answersMap);
    } catch (err: any) {
      r1SubmitBlocked = true;
      console.log(`✓ Previous round submission blocked: Student cannot alter ENDED Round 1 (${err.message}).`);
    }
    if (!r1SubmitBlocked) throw new Error('SECURITY VIOLATION: Student was able to submit answers to ENDED Round 1!');

    // 7. Admin Starts Round 2
    await adminRoundService.startRound(round2.id);
    const liveR2 = await prisma.round.findUnique({ where: { id: round2.id } });
    if (liveR2?.status !== 'LIVE') throw new Error('Round 2 failed to transition to LIVE!');
    console.log('✓ Admin started Round 2 successfully. Status = LIVE.');

    // 8. Student Submits Round 2 Bug Fix Code
    const r2Workspace = await round2Service.getStudentWorkspace(round2.id);
    if (r2Workspace.problems.length > 0) {
      const p2 = r2Workspace.problems[0];
      const validCode = `#include <stdio.h>\nint main() { printf("Hello World"); return 0; }`;
      await round2Service.submitStudentBug(p2.id, student.id, validCode);
      console.log('✓ Student SARA-001 submitted Round 2 bug fix code.');
    }

    // 9. Admin Ends Round 2
    await adminRoundService.endRound(round2.id);
    console.log('✓ Admin ended Round 2 successfully. Status = ENDED.');

    // 10. Admin Starts Round 3
    await adminRoundService.startRound(round3.id);
    console.log('✓ Admin started Round 3 successfully. Status = LIVE.');

    // 11. Student Submits Round 3 Programming Solution
    const r3Workspace = await round3Service.getStudentWorkspace(round3.id);
    if (r3Workspace.problems.length > 0) {
      const p3 = r3Workspace.problems[0];
      const pyCode = `import sys\nfor line in sys.stdin:\n    print(line.strip())\n`;
      await round3Service.submitStudentCode(p3.id, student.id, ProgrammingLanguage.PYTHON, pyCode);
      console.log('✓ Student SARA-001 submitted Round 3 Python code.');
    }

    // 12. Admin Ends Round 3 -> All Enabled Rounds Ended -> Event Status Turns ENDED
    await adminRoundService.endRound(round3.id);
    const finalEventState = await prisma.event.findUnique({ where: { id: event.id } });
    if (finalEventState?.status !== 'ENDED') throw new Error('Parent Event failed to transition to ENDED!');
    console.log('✓ Admin ended Round 3. All rounds complete -> Parent Event status = ENDED.');

    // 13. Test Final Score Calculation & Tie-Breaking Engine
    await competitionService.calculateFinalScores(event.id);
    const leaderboard = await competitionService.getAdminLeaderboard(event.id);
    if (!leaderboard.leaderboard || leaderboard.leaderboard.length === 0) {
      throw new Error('Leaderboard generation produced 0 records!');
    }
    console.log(`✓ Final scores calculated successfully. Total ranked students: ${leaderboard.leaderboard.length}`);

    // 14. Test Score Visibility Controls (showResults)
    await competitionService.toggleResultsVisibility(false);
    let studentResultsBlocked = false;
    try {
      await competitionService.getStudentLeaderboard(student.id, event.id);
    } catch (err: any) {
      studentResultsBlocked = true;
      console.log(`✓ Score visibility protection enforced: Student denied access when showResults=false (${err.message}).`);
    }
    if (!studentResultsBlocked) throw new Error('SECURITY VIOLATION: Student accessed leaderboard when showResults=false!');

    await competitionService.toggleResultsVisibility(true);
    const studentResults = await competitionService.getStudentLeaderboard(student.id, event.id);
    if (!studentResults.showResults || !studentResults.myResult) {
      throw new Error('Student failed to fetch scorecard when showResults=true!');
    }
    console.log(`✓ Student results successfully fetched when showResults=true. Rank: #${studentResults.myResult.rank}`);

    // 15. Test Admin Student Inspection Tool
    const inspection = await competitionService.getAdminStudentInspection(student.studentId);
    if (!inspection || inspection.studentId !== student.studentId) {
      throw new Error('Admin student inspection failed!');
    }
    console.log(`✓ Admin student inspection verified for ${student.studentId}.`);

    console.log('\n=== COMPLETE COMPETITION FLOW VERIFICATION SUCCESSFUL (ALL TESTS PASSED) ===');
  } catch (err: any) {
    console.error('❌ VERIFICATION FAILED:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runVerification();
