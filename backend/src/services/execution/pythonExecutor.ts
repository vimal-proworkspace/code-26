import fs from 'fs';
import path from 'path';
import { BaseExecutor } from './baseExecutor';
import { CodeExecutionRequest, ExecutionResult, TestCaseExecutionResult, SubmissionStatus } from './types';

export class PythonExecutor extends BaseExecutor {
  protected languageName = 'Python';

  public async execute(request: CodeExecutionRequest): Promise<ExecutionResult> {
    const tempDir = await this.createTempDir();
    const sourceFilePath = path.join(tempDir, 'solution.py');

    try {
      // 1. Write Python source code to temp directory
      await fs.promises.writeFile(sourceFilePath, request.sourceCode, 'utf-8');

      // Python is an interpreted language; determine command (python3 vs python)
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

      const testResults: TestCaseExecutionResult[] = [];
      let totalScore = 0;
      let totalPassedTests = 0;
      let overallExecutionTimeMs = 0;
      let overallStatus: SubmissionStatus = 'ACCEPTED';

      for (const testCase of request.testCases) {
        const runRes = await this.runProcess(pythonCmd, ['solution.py'], {
          cwd: tempDir,
          inputData: testCase.input,
          timeLimitMs: request.timeLimitMs || 3000,
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
        language: 'PYTHON',
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
