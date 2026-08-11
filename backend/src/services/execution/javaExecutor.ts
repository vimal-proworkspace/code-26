import fs from 'fs';
import path from 'path';
import { BaseExecutor } from './baseExecutor';
import { CodeExecutionRequest, ExecutionResult, TestCaseExecutionResult, SubmissionStatus } from './types';

export class JavaExecutor extends BaseExecutor {
  protected languageName = 'Java';

  public async execute(request: CodeExecutionRequest): Promise<ExecutionResult> {
    const tempDir = await this.createTempDir();
    const sourceFilePath = path.join(tempDir, 'Solution.java');

    try {
      // 1. Write Java source code to temp directory
      await fs.promises.writeFile(sourceFilePath, request.sourceCode, 'utf-8');

      // 2. Compile Java source code with javac
      const compileResult = await this.runProcess('javac', ['Solution.java'], {
        cwd: tempDir,
        timeLimitMs: 10000,
      });

      if (compileResult.exitCode !== 0) {
        return {
          language: 'JAVA',
          compileStatus: 'COMPILATION_ERROR',
          compileOutput: compileResult.stderr || compileResult.stdout || 'Compilation failed',
          testResults: [],
          totalPassedTests: 0,
          totalTests: request.testCases.length,
          score: 0,
          maximumScore: request.testCases.reduce((acc, tc) => acc + tc.marks, 0),
          submissionStatus: 'COMPILATION_ERROR',
          totalExecutionTimeMs: compileResult.executionTimeMs,
        };
      }

      // 3. Execute test cases against compiled bytecode
      const testResults: TestCaseExecutionResult[] = [];
      let totalScore = 0;
      let totalPassedTests = 0;
      let overallExecutionTimeMs = 0;
      let overallStatus: SubmissionStatus = 'ACCEPTED';

      for (const testCase of request.testCases) {
        const runRes = await this.runProcess('java', ['-cp', '.', 'Solution'], {
          cwd: tempDir,
          inputData: testCase.input,
          timeLimitMs: request.timeLimitMs || 4000, // Java JVM startup buffer
        });

        overallExecutionTimeMs += runRes.executionTimeMs;
        let tcStatus: SubmissionStatus = 'WRONG_ANSWER';
        let marksAwarded = 0;

        if (runRes.isTimedOut) {
          tcStatus = 'TIME_LIMIT_EXCEEDED';
        } else if (runRes.exitCode !== 0) {
          tcStatus = 'RUNTIME_ERROR';
        } else {
          const actualNormalized = this.normalizeOutput(runRes.stdout);
          const expectedNormalized = this.normalizeOutput(testCase.expectedOutput);

          if (actualNormalized === expectedNormalized) {
            tcStatus = 'ACCEPTED';
            marksAwarded = testCase.marks;
            totalPassedTests++;
            totalScore += marksAwarded;
          } else {
            tcStatus = 'WRONG_ANSWER';
          }
        }

        if (tcStatus !== 'ACCEPTED' && overallStatus === 'ACCEPTED') {
          overallStatus = tcStatus;
        }

        testResults.push({
          testCaseId: testCase.id,
          status: tcStatus,
          actualOutput: runRes.stdout,
          expectedOutput: testCase.visibility === 'VISIBLE' ? testCase.expectedOutput : undefined,
          executionTimeMs: runRes.executionTimeMs,
          marksAwarded,
          visibility: testCase.visibility,
          errorOutput: tcStatus === 'RUNTIME_ERROR' ? runRes.stderr : undefined,
        });
      }

      const maximumScore = request.testCases.reduce((acc, tc) => acc + tc.marks, 0);

      return {
        language: 'JAVA',
        compileStatus: 'SUCCESS',
        testResults,
        totalPassedTests,
        totalTests: request.testCases.length,
        score: totalScore,
        maximumScore,
        submissionStatus: overallStatus,
        totalExecutionTimeMs: overallExecutionTimeMs,
      };
    } finally {
      await this.cleanupTempDir(tempDir);
    }
  }
}
