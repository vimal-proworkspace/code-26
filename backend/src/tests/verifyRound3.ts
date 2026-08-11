import { prisma } from '../config/database';
import { round3Service } from '../services/round3.service';
import { RoundStatus, RoundType, TestCaseVisibility } from '@prisma/client';

async function runVerification() {
  console.log('=== STARTING ROUND 3 VERIFICATION TEST ===\n');

  try {
    // 1. Get or create test Event & Round 3
    let event = await prisma.event.findFirst();
    if (!event) {
      event = await prisma.event.create({
        data: { name: 'Verification Event 2026', status: 'READY' },
      });
    }

    let round3 = await prisma.round.findFirst({ where: { type: RoundType.PROGRAMMING } });
    if (!round3) {
      round3 = await prisma.round.create({
        data: {
          eventId: event.id,
          name: 'Round 3 — Programming Challenge Test',
          type: RoundType.PROGRAMMING,
          order: 3,
          duration: 40,
          maximumMarks: 100,
          status: RoundStatus.LIVE,
        },
      });
    } else {
      await prisma.round.update({
        where: { id: round3.id },
        data: { status: RoundStatus.LIVE, endTime: new Date(Date.now() + 3600 * 1000) },
      });
    }

    // 2. Get test Student (SARA-001)
    const student = await prisma.student.findFirst({ where: { studentId: 'SARA-001' } });
    if (!student) {
      throw new Error('Seeded student SARA-001 not found. Ensure database is seeded.');
    }

    console.log('✓ Target Event, Round 3 (LIVE), and Student SARA-001 resolved.');

    // 3. Create Test Programming Problem with allowed languages C & JAVA only
    const problem = await round3Service.createProgrammingProblem(round3.id, {
      title: 'Square of N',
      description: 'Read integer N from stdin and print N^2 to stdout.',
      supportedLanguages: ['C', 'JAVA'],
      maximumMarks: 50,
    });
    console.log('✓ Created Programming Problem (Allowed languages: C, JAVA):', problem.id);

    // 4. Create Visible and Hidden Test Cases
    const visibleCase = await round3Service.createTestCase(problem.id, {
      input: '5',
      expectedOutput: '25',
      marks: 20,
      visibility: TestCaseVisibility.VISIBLE,
    });

    const hiddenCase = await round3Service.createTestCase(problem.id, {
      input: '10',
      expectedOutput: '100',
      marks: 30,
      visibility: TestCaseVisibility.HIDDEN,
    });

    console.log('✓ Created Test Cases: Visible (20 marks), Hidden (30 marks).');

    // 5. Test Backend Language Enforcement (Reject unauthorized language: PYTHON)
    try {
      await round3Service.submitStudentCode(round3.id, student.id, problem.id, 'PYTHON', 'print(int(input())**2)');
      throw new Error('SECURITY VIOLATION: Backend failed to reject unauthorized language PYTHON!');
    } catch (err: any) {
      if (err.message.includes('SECURITY VIOLATION')) throw err;
      console.log('✓ Backend correctly rejected unauthorized language PYTHON.');
    }

    // 6. Test Student Workspace Load & Hidden Test Case Security
    const studentWorkspace = await round3Service.getStudentRound3(round3.id, student.id);
    if (studentWorkspace.problem.visibleTestCases.length !== 1) {
      throw new Error('SECURITY VIOLATION: Hidden test case returned to student workspace!');
    }
    console.log('✓ Student workspace returned ONLY visible test cases.');

    // 7. Test "Run Code" against Visible Test Cases Only
    const cSourceCode = `#include <stdio.h>\nint main() {\n    int n;\n    if(scanf("%d", &n) == 1) {\n        printf("%d", n * n);\n    }\n    return 0;\n}`;
    const runResult = await round3Service.runStudentCode(round3.id, student.id, problem.id, 'C', cSourceCode);
    console.log('✓ Run Visible Tests Result:', {
      passed: runResult.totalPassedTests,
      total: runResult.totalTests,
      status: runResult.status,
    });

    if (runResult.totalTests !== 1 || runResult.totalPassedTests !== 1) {
      throw new Error('Visible test case run failed!');
    }

    // 8. Test Official Code Submission (Visible + Hidden Tests)
    const subResult = await round3Service.submitStudentCode(round3.id, student.id, problem.id, 'C', cSourceCode);
    console.log('✓ Official Submission Result:', {
      passed: subResult.passedTests,
      total: subResult.totalTests,
      score: subResult.score,
      maxScore: subResult.maximumScore,
    });

    if (subResult.passedTests !== 2 || subResult.score !== 50) {
      throw new Error(`Expected score 50 (all tests passed), got ${subResult.score}`);
    }

    // 9. Verify Hidden Test Results Omit Secret Input & Output
    const hiddenResultItem = subResult.testResults.find((r) => r.visibility === TestCaseVisibility.HIDDEN);
    if ((hiddenResultItem as any)?.input || (hiddenResultItem as any)?.expectedOutput) {
      throw new Error('SECURITY VIOLATION: Hidden test case input/output exposed in submission result!');
    }
    console.log('✓ Submission result strictly sanitized hidden test case inputs and outputs.');

    // 10. Admin Inspection & Cleanup
    const adminSubs = await round3Service.getAdminSubmissions(problem.id, student.id);
    console.log('✓ Admin fetched historical submissions count:', adminSubs.length);

    // Cleanup verification records safely
    await prisma.testCase.deleteMany({ where: { programmingProblemId: problem.id } });
    await prisma.programmingSubmission.deleteMany({ where: { programmingProblemId: problem.id } });
    await prisma.programmingProblem.delete({ where: { id: problem.id } });

    console.log('\n=== ROUND 3 VERIFICATION SUCCESSFUL (ALL TESTS PASSED) ===');
  } catch (err: any) {
    console.error('❌ VERIFICATION FAILED:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runVerification();
