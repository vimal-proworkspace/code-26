import { prisma } from '../config/database';
import { round2Service } from '../services/round2.service';
import { RoundStatus, RoundType } from '@prisma/client';

async function runVerification() {
  console.log('=== STARTING ROUND 2 VERIFICATION TEST ===\n');

  try {
    // 1. Get or create test Event & Round 2
    let event = await prisma.event.findFirst();
    if (!event) {
      event = await prisma.event.create({
        data: { name: 'Verification Event 2026', status: 'READY' },
      });
    }

    let round2 = await prisma.round.findFirst({ where: { type: RoundType.DEBUGGING } });
    if (!round2) {
      round2 = await prisma.round.create({
        data: {
          eventId: event.id,
          name: 'Round 2 — Bug Hunt Test',
          type: RoundType.DEBUGGING,
          order: 2,
          duration: 30,
          maximumMarks: 10,
          status: RoundStatus.LIVE,
        },
      });
    } else {
      await prisma.round.update({
        where: { id: round2.id },
        data: { status: RoundStatus.LIVE, endTime: new Date(Date.now() + 3600 * 1000) },
      });
    }

    // 2. Get test Student (SARA-001)
    const student = await prisma.student.findFirst({ where: { studentId: 'SARA-001' } });
    if (!student) {
      throw new Error('Seeded student SARA-001 not found. Ensure database is seeded.');
    }

    console.log('✓ Target Event, Round 2 (LIVE), and Student SARA-001 resolved.');

    // 3. Create Test Debugging Problem
    const problem = await round2Service.createDebuggingProblem(round2.id, {
      title: 'Fix Array Sum Bug',
      description: 'Fix the off-by-one bug and output formatting in the array sum C program.',
      buggyCode: `#include <stdio.h>\nint main() {\n    int arr[3] = {10, 20, 30};\n    int sum = 0;\n    for(int i = 0; i <= 3; i++) {\n        sum += arr[i];\n    }\n    printf("SUM=%d", sum);\n    return 0;\n}`,
      maximumMarks: 5,
    });
    console.log('✓ Created Debugging Problem:', problem.id);

    // 4. Create Bug Definitions (BUG-001 = 2 marks, BUG-002 = 3 marks)
    const bug1 = await round2Service.createBugDefinition(problem.id, {
      bugId: 'BUG-001',
      title: 'Fix off-by-one loop condition',
      marks: 2,
      validationConfig: {
        mustInclude: ['i < 3'],
        mustExclude: ['i <= 3'],
      },
    });

    const bug2 = await round2Service.createBugDefinition(problem.id, {
      bugId: 'BUG-002',
      title: 'Correct expected output format',
      marks: 3,
      validationConfig: {
        expectedOutput: 'TOTAL_SUM=60',
        comparisonMethod: 'TRIM',
      },
    });

    console.log('✓ Created Bug Definitions:', bug1.bugId, '(2 marks),', bug2.bugId, '(3 marks).');

    // 5. Test Student Workspace Load & Hidden Answer Stripping
    const studentWorkspace = await round2Service.getStudentRound2(round2.id, student.id);
    if ((studentWorkspace.problem as any).solutionCode || (studentWorkspace.problem as any).bugDefinitions) {
      throw new Error('SECURITY VIOLATION: Student workspace exposed sensitive solution/bug criteria!');
    }
    console.log('✓ Student workspace stripped sensitive bug validation criteria.');

    // 6. Test Local C Execution (Run Code)
    const runResult = await round2Service.runStudentCode(
      round2.id,
      student.id,
      problem.id,
      problem.buggyCode,
      ''
    );
    console.log('✓ Local C Execution Run Status:', runResult.compileStatus);

    // 7. Test Partial Fix Submission (Fix BUG-001 only)
    const partialFixCode = `#include <stdio.h>\nint main() {\n    int arr[3] = {10, 20, 30};\n    int sum = 0;\n    for(int i = 0; i < 3; i++) {\n        sum += arr[i];\n    }\n    printf("SUM=%d", sum);\n    return 0;\n}`;

    const sub1 = await round2Service.submitStudentCode(round2.id, student.id, problem.id, partialFixCode);
    console.log('✓ Submission 1 (BUG-001 fixed):', {
      newlyFixed: sub1.newlyFixedBugsCount,
      newScore: sub1.newScorePoints,
      totalScore: sub1.totalScore,
    });

    if (sub1.newlyFixedBugsCount !== 1 || sub1.totalScore !== 2) {
      throw new Error(`Expected score 2 for BUG-001, got ${sub1.totalScore}`);
    }

    // 8. Test Duplicate Submission Protection (Submit same code again)
    const sub2 = await round2Service.submitStudentCode(round2.id, student.id, problem.id, partialFixCode);
    console.log('✓ Submission 2 (Duplicate check):', {
      newlyFixed: sub2.newlyFixedBugsCount,
      newScore: sub2.newScorePoints,
      totalScore: sub2.totalScore,
    });

    if (sub2.newlyFixedBugsCount !== 0 || sub2.newScorePoints !== 0 || sub2.totalScore !== 2) {
      throw new Error('SECURITY VIOLATION: Duplicate submission awarded points twice!');
    }

    // 9. Test Full Fix Submission (Fix BUG-001 + BUG-002)
    const fullFixCode = `#include <stdio.h>\nint main() {\n    int arr[3] = {10, 20, 30};\n    int sum = 0;\n    for(int i = 0; i < 3; i++) {\n        sum += arr[i];\n    }\n    printf("TOTAL_SUM=%d", sum);\n    return 0;\n}`;

    const sub3 = await round2Service.submitStudentCode(round2.id, student.id, problem.id, fullFixCode);
    console.log('✓ Submission 3 (BUG-002 fixed):', {
      newlyFixed: sub3.newlyFixedBugsCount,
      newScore: sub3.newScorePoints,
      totalScore: sub3.totalScore,
    });

    if (sub3.newlyFixedBugsCount !== 1 || sub3.totalScore !== 5) {
      throw new Error(`Expected total score 5 for fixing both bugs, got ${sub3.totalScore}`);
    }

    // 10. Admin Inspection & Cleanup
    const adminSubs = await round2Service.getAdminSubmissions(problem.id, student.id);
    console.log('✓ Admin fetched historical submissions count:', adminSubs.length);

    // Clean up verification records safely
    await prisma.bugAward.deleteMany({ where: { bugDefinition: { debuggingProblemId: problem.id } } });
    await prisma.debuggingSubmission.deleteMany({ where: { debuggingProblemId: problem.id } });
    await prisma.debuggingProblem.delete({ where: { id: problem.id } });

    console.log('\n=== ROUND 2 VERIFICATION SUCCESSFUL (ALL TESTS PASSED) ===');
  } catch (err: any) {
    console.error('❌ VERIFICATION FAILED:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runVerification();
