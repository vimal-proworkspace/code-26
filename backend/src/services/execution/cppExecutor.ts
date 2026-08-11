import fs from 'fs';
import path from 'path';
import os from 'os';
import { BaseExecutor } from './baseExecutor';
import { CodeExecutionRequest, ExecutionResult, TestCaseExecutionResult, SubmissionStatus } from './types';

export class CppExecutor extends BaseExecutor {
  protected languageName = 'C++';

  public async execute(request: CodeExecutionRequest): Promise<ExecutionResult> {
    const tempDir = await this.createTempDir();
    const sourceFilePath = path.join(tempDir, 'solution.cpp');
    const isWindows = os.platform() === 'win32';
    const binaryName = isWindows ? 'solution.exe' : 'solution';
    const binaryPath = path.join(tempDir, binaryName);

    try {
      // 1. Write C++ source code to temp directory
      await fs.promises.writeFile(sourceFilePath, request.sourceCode, 'utf-8');

      // 2. Compile C++ source code with g++
      const compileResult = await this.runProcess('g++', ['-O2', 'solution.cpp', '-o', binaryName], {
        cwd: tempDir,
        timeLimitMs: 10000,
      });

      if (compileResult.exitCode !== 0) {
        return {
          language: 'CPP',
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

      // 3. Execute test cases against compiled binary
      const testResults: TestCaseExecutionResult[] = [];
      let totalScore = 0;
      let totalPassedTests = 0;
      let overallExecutionTimeMs = 0;
      let overallStatus: SubmissionStatus = 'ACCEPTED';

      const runExecutableCommand = isWindows ? binaryPath : `./${binaryName}`;

      for (const testCase of request.testCases) {
        const runRes = await this.runProcess(runExecutableCommand, [], {
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
        language: 'CPP',
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
