import { ProgrammingLanguage } from '@prisma/client';
import { BaseExecutor } from './baseExecutor';
import { CExecutor } from './cExecutor';
import { CppExecutor } from './cppExecutor';
import { JavaExecutor } from './javaExecutor';
import { PythonExecutor } from './pythonExecutor';
import { CodeExecutionRequest, ExecutionResult } from './types';

/**
 * CodeExecutionService
 *
 * Unified entry point for backend code execution.
 * Maps ProgrammingLanguage enum values to corresponding language executors.
 * This service is designed to be decoupled from Express and can be called
 * from any backend module (routes, services, workers).
 *
 * Supported languages:
 *   C       → CExecutor   (gcc)
 *   CPP     → CppExecutor (g++)
 *   JAVA    → JavaExecutor (javac + java)
 *   PYTHON  → PythonExecutor (python3/python)
 */
export class CodeExecutionService {
  private executors: Map<ProgrammingLanguage, BaseExecutor>;

  constructor() {
    this.executors = new Map<ProgrammingLanguage, BaseExecutor>([
      ['C', new CExecutor()],
      ['CPP', new CppExecutor()],
      ['JAVA', new JavaExecutor()],
      ['PYTHON', new PythonExecutor()],
    ]);
  }

  /**
   * Returns the list of languages this service currently supports.
   */
  public getSupportedLanguages(): ProgrammingLanguage[] {
    return Array.from(this.executors.keys());
  }

  /**
   * Checks whether a given language is supported by the execution engine.
   */
  public isLanguageSupported(language: ProgrammingLanguage): boolean {
    return this.executors.has(language);
  }

  /**
   * Executes submitted source code against supplied test cases.
   *
   * 1. Validates the language.
   * 2. Selects the correct executor.
   * 3. Delegates compilation + execution to the executor.
   * 4. Returns normalized ExecutionResult.
   *
   * @throws Error if the language is not supported.
   */
  public async executeCode(request: CodeExecutionRequest): Promise<ExecutionResult> {
    const executor = this.executors.get(request.language);

    if (!executor) {
      throw new Error(
        `Unsupported programming language: ${request.language}. ` +
        `Supported: ${this.getSupportedLanguages().join(', ')}`
      );
    }

    // Validate source code is not empty
    if (!request.sourceCode || request.sourceCode.trim().length === 0) {
      return {
        language: request.language,
        compileStatus: 'COMPILATION_ERROR',
        compileOutput: 'Source code is empty.',
        testResults: [],
        totalPassedTests: 0,
        totalTests: request.testCases.length,
        score: 0,
        maximumScore: request.testCases.reduce((acc, tc) => acc + tc.marks, 0),
        submissionStatus: 'COMPILATION_ERROR',
        totalExecutionTimeMs: 0,
      };
    }

    // Validate at least one test case exists
    if (!request.testCases || request.testCases.length === 0) {
      return {
        language: request.language,
        compileStatus: 'SUCCESS',
        testResults: [],
        totalPassedTests: 0,
        totalTests: 0,
        score: 0,
        maximumScore: 0,
        submissionStatus: 'ACCEPTED',
        totalExecutionTimeMs: 0,
      };
    }

    // Delegate to the language-specific executor
    return executor.execute(request);
  }

  /**
   * Convenience method for running code against only VISIBLE test cases.
   * Used for the student "RUN" button (practice run, not official submission).
   */
  public async runCode(request: CodeExecutionRequest): Promise<ExecutionResult> {
    const visibleTestCases = request.testCases.filter((tc) => tc.visibility === 'VISIBLE');
    return this.executeCode({
      ...request,
      testCases: visibleTestCases,
      isRunOnly: true,
    });
  }

  /**
   * Convenience method for running code against ALL test cases (including HIDDEN).
   * Used for the student "SUBMIT" button (official submission).
   * Hidden test case expected outputs are never returned to the student.
   */
  public async submitCode(request: CodeExecutionRequest): Promise<ExecutionResult> {
    return this.executeCode({
      ...request,
      isRunOnly: false,
    });
  }
}

// Singleton instance for use across the backend
export const codeExecutionService = new CodeExecutionService();
