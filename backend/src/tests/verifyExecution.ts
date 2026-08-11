/**
 * Verification Test Script for CodeExecutionService
 *
 * Tests all 4 language executors (C, C++, Java, Python) with:
 *   - Correct answer (ACCEPTED)
 *   - Wrong answer (WRONG_ANSWER)
 *   - Compilation error (COMPILATION_ERROR)
 *   - Runtime error (RUNTIME_ERROR)
 *   - Timeout / infinite loop (TIME_LIMIT_EXCEEDED)
 *   - Multiple test cases
 *
 * Usage: npx ts-node src/tests/verifyExecution.ts
 */

import { CodeExecutionService } from '../services/execution/codeExecutionService';
import { CodeExecutionRequest, TestCaseInput } from '../services/execution/types';

const service = new CodeExecutionService();

// =============================================
// Test Case Helpers
// =============================================

function makeTestCase(input: string, expected: string, marks = 10, id = 'tc-1'): TestCaseInput {
  return { id, input, expectedOutput: expected, marks, visibility: 'VISIBLE' };
}

function makeHiddenTestCase(input: string, expected: string, marks = 10, id = 'tc-h'): TestCaseInput {
  return { id, input, expectedOutput: expected, marks, visibility: 'HIDDEN' };
}

// =============================================
// Source Code Samples
// =============================================

const C_CORRECT = `
#include <stdio.h>
int main() {
    int a, b;
    scanf("%d %d", &a, &b);
    printf("%d", a + b);
    return 0;
}
`;

const C_WRONG = `
#include <stdio.h>
int main() {
    printf("999");
    return 0;
}
`;

const C_COMPILE_ERROR = `
#include <stdio.h>
int main() {
    this is not valid C code
    return 0;
}
`;

const C_RUNTIME_ERROR = `
#include <stdio.h>
int main() {
    int *p = 0;
    *p = 42;
    return 0;
}
`;

const C_INFINITE_LOOP = `
#include <stdio.h>
int main() {
    while(1) {}
    return 0;
}
`;

const CPP_CORRECT = `
#include <iostream>
using namespace std;
int main() {
    int a, b;
    cin >> a >> b;
    cout << a + b;
    return 0;
}
`;

const JAVA_CORRECT = `
import java.util.Scanner;
public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int a = sc.nextInt();
        int b = sc.nextInt();
        System.out.print(a + b);
    }
}
`;

const JAVA_COMPILE_ERROR = `
public class Solution {
    public static void main(String[] args) {
        this is not valid Java
    }
}
`;

const PYTHON_CORRECT = `
a, b = map(int, input().split())
print(a + b)
`;

const PYTHON_RUNTIME_ERROR = `
x = 1 / 0
`;

const PYTHON_INFINITE_LOOP = `
while True:
    pass
`;

// =============================================
// Test Runner
// =============================================

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
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, details: msg });
    console.log(`  ❌ ${name}: ${msg}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

// =============================================
// Tests
// =============================================

async function main() {
  console.log('\n========================================');
  console.log('Code Execution Service Verification');
  console.log('========================================\n');

  // Check supported languages
  console.log('Supported languages:', service.getSupportedLanguages().join(', '));
  console.log('');

  // ============ C TESTS ============
  console.log('--- C Language Tests ---');

  await runTest('C: Correct Answer', async () => {
    const res = await service.executeCode({
      language: 'C',
      sourceCode: C_CORRECT,
      testCases: [makeTestCase('2 3', '5')],
      timeLimitMs: 5000,
    });
    assert(res.compileStatus === 'SUCCESS', `Expected SUCCESS, got ${res.compileStatus}`);
    assert(res.submissionStatus === 'ACCEPTED', `Expected ACCEPTED, got ${res.submissionStatus}`);
    assert(res.totalPassedTests === 1, `Expected 1 passed, got ${res.totalPassedTests}`);
    assert(res.score === 10, `Expected score 10, got ${res.score}`);
  });

  await runTest('C: Wrong Answer', async () => {
    const res = await service.executeCode({
      language: 'C',
      sourceCode: C_WRONG,
      testCases: [makeTestCase('2 3', '5')],
      timeLimitMs: 5000,
    });
    assert(res.compileStatus === 'SUCCESS', `Expected SUCCESS, got ${res.compileStatus}`);
    assert(res.submissionStatus === 'WRONG_ANSWER', `Expected WRONG_ANSWER, got ${res.submissionStatus}`);
    assert(res.score === 0, `Expected score 0, got ${res.score}`);
  });

  await runTest('C: Compilation Error', async () => {
    const res = await service.executeCode({
      language: 'C',
      sourceCode: C_COMPILE_ERROR,
      testCases: [makeTestCase('2 3', '5')],
      timeLimitMs: 5000,
    });
    assert(res.compileStatus === 'COMPILATION_ERROR', `Expected COMPILATION_ERROR, got ${res.compileStatus}`);
    assert(res.submissionStatus === 'COMPILATION_ERROR', `Expected COMPILATION_ERROR, got ${res.submissionStatus}`);
    assert(res.score === 0, `Expected score 0, got ${res.score}`);
    assert(!!res.compileOutput, 'Expected compiler output');
  });

  await runTest('C: Runtime Error', async () => {
    const res = await service.executeCode({
      language: 'C',
      sourceCode: C_RUNTIME_ERROR,
      testCases: [makeTestCase('1 2', '3')],
      timeLimitMs: 5000,
    });
    assert(res.compileStatus === 'SUCCESS', `Expected SUCCESS, got ${res.compileStatus}`);
    assert(
      res.submissionStatus === 'RUNTIME_ERROR' || res.submissionStatus === 'WRONG_ANSWER',
      `Expected RUNTIME_ERROR or WRONG_ANSWER, got ${res.submissionStatus}`
    );
  });

  await runTest('C: Timeout (Infinite Loop)', async () => {
    const res = await service.executeCode({
      language: 'C',
      sourceCode: C_INFINITE_LOOP,
      testCases: [makeTestCase('', '')],
      timeLimitMs: 2000,
    });
    assert(res.compileStatus === 'SUCCESS', `Expected SUCCESS, got ${res.compileStatus}`);
    assert(res.submissionStatus === 'TIME_LIMIT_EXCEEDED', `Expected TLE, got ${res.submissionStatus}`);
  });

  await runTest('C: Multiple Test Cases', async () => {
    const res = await service.executeCode({
      language: 'C',
      sourceCode: C_CORRECT,
      testCases: [
        makeTestCase('1 2', '3', 10, 'tc-1'),
        makeTestCase('10 20', '30', 10, 'tc-2'),
        makeTestCase('0 0', '0', 10, 'tc-3'),
        makeHiddenTestCase('-5 5', '0', 10, 'tc-4'),
      ],
      timeLimitMs: 5000,
    });
    assert(res.totalTests === 4, `Expected 4 tests, got ${res.totalTests}`);
    assert(res.totalPassedTests === 4, `Expected 4 passed, got ${res.totalPassedTests}`);
    assert(res.score === 40, `Expected score 40, got ${res.score}`);
    assert(res.maximumScore === 40, `Expected max 40, got ${res.maximumScore}`);

    // Verify hidden test case does not expose expected output
    const hiddenResult = res.testResults.find((t) => t.testCaseId === 'tc-4');
    assert(hiddenResult !== undefined, 'Hidden test case result missing');
    assert(hiddenResult!.expectedOutput === undefined, 'Hidden test case should not expose expectedOutput');
  });

  // ============ C++ TESTS ============
  console.log('\n--- C++ Language Tests ---');

  await runTest('C++: Correct Answer', async () => {
    const res = await service.executeCode({
      language: 'CPP',
      sourceCode: CPP_CORRECT,
      testCases: [makeTestCase('2 3', '5')],
      timeLimitMs: 5000,
    });
    assert(res.compileStatus === 'SUCCESS', `Expected SUCCESS, got ${res.compileStatus}`);
    assert(res.submissionStatus === 'ACCEPTED', `Expected ACCEPTED, got ${res.submissionStatus}`);
    assert(res.score === 10, `Expected score 10, got ${res.score}`);
  });

  // ============ JAVA TESTS ============
  console.log('\n--- Java Language Tests ---');

  await runTest('Java: Correct Answer', async () => {
    const res = await service.executeCode({
      language: 'JAVA',
      sourceCode: JAVA_CORRECT,
      testCases: [makeTestCase('2 3', '5')],
      timeLimitMs: 10000,
    });
    assert(res.compileStatus === 'SUCCESS', `Expected SUCCESS, got ${res.compileStatus}`);
    assert(res.submissionStatus === 'ACCEPTED', `Expected ACCEPTED, got ${res.submissionStatus}`);
    assert(res.score === 10, `Expected score 10, got ${res.score}`);
  });

  await runTest('Java: Compilation Error', async () => {
    const res = await service.executeCode({
      language: 'JAVA',
      sourceCode: JAVA_COMPILE_ERROR,
      testCases: [makeTestCase('2 3', '5')],
      timeLimitMs: 10000,
    });
    assert(res.compileStatus === 'COMPILATION_ERROR', `Expected COMPILATION_ERROR, got ${res.compileStatus}`);
    assert(res.score === 0, `Expected score 0, got ${res.score}`);
  });

  // ============ PYTHON TESTS ============
  console.log('\n--- Python Language Tests ---');

  await runTest('Python: Correct Answer', async () => {
    const res = await service.executeCode({
      language: 'PYTHON',
      sourceCode: PYTHON_CORRECT,
      testCases: [makeTestCase('2 3', '5')],
      timeLimitMs: 5000,
    });
    assert(res.compileStatus === 'SUCCESS', `Expected SUCCESS, got ${res.compileStatus}`);
    assert(res.submissionStatus === 'ACCEPTED', `Expected ACCEPTED, got ${res.submissionStatus}`);
    assert(res.score === 10, `Expected score 10, got ${res.score}`);
  });

  await runTest('Python: Runtime Error', async () => {
    const res = await service.executeCode({
      language: 'PYTHON',
      sourceCode: PYTHON_RUNTIME_ERROR,
      testCases: [makeTestCase('', '')],
      timeLimitMs: 5000,
    });
    assert(res.submissionStatus === 'RUNTIME_ERROR', `Expected RUNTIME_ERROR, got ${res.submissionStatus}`);
    assert(res.score === 0, `Expected score 0, got ${res.score}`);
  });

  await runTest('Python: Timeout (Infinite Loop)', async () => {
    const res = await service.executeCode({
      language: 'PYTHON',
      sourceCode: PYTHON_INFINITE_LOOP,
      testCases: [makeTestCase('', '')],
      timeLimitMs: 2000,
    });
    assert(res.submissionStatus === 'TIME_LIMIT_EXCEEDED', `Expected TLE, got ${res.submissionStatus}`);
  });

  // ============ EDGE CASES ============
  console.log('\n--- Edge Case Tests ---');

  await runTest('Empty Source Code', async () => {
    const res = await service.executeCode({
      language: 'C',
      sourceCode: '',
      testCases: [makeTestCase('1 2', '3')],
    });
    assert(res.compileStatus === 'COMPILATION_ERROR', `Expected COMPILATION_ERROR, got ${res.compileStatus}`);
  });

  await runTest('Unsupported Language', async () => {
    try {
      await service.executeCode({
        language: 'RUBY' as any,
        sourceCode: 'puts "hello"',
        testCases: [makeTestCase('', 'hello')],
      });
      throw new Error('Should have thrown for unsupported language');
    } catch (err) {
      assert(
        err instanceof Error && err.message.includes('Unsupported'),
        `Expected Unsupported error, got: ${err}`
      );
    }
  });

  await runTest('Run Code (Visible Only)', async () => {
    const res = await service.runCode({
      language: 'PYTHON',
      sourceCode: PYTHON_CORRECT,
      testCases: [
        makeTestCase('1 2', '3', 10, 'vis-1'),
        makeHiddenTestCase('10 20', '30', 10, 'hid-1'),
      ],
      timeLimitMs: 5000,
    });
    assert(res.totalTests === 1, `Expected 1 test (visible only), got ${res.totalTests}`);
    assert(res.totalPassedTests === 1, `Expected 1 passed, got ${res.totalPassedTests}`);
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
  process.exit(failed > 0 ? 1 : 0);
}

main();
