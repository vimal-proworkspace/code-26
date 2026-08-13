import { ProgrammingLanguage, TestCaseVisibility } from '../../config/types';

export type SubmissionStatus =
  | 'ACCEPTED'
  | 'WRONG_ANSWER'
  | 'COMPILATION_ERROR'
  | 'TIME_LIMIT_EXCEEDED'
  | 'RUNTIME_ERROR'
  | 'PENDING';

export interface TestCaseInput {
  id: string;
  input: string;
  expectedOutput: string;
  marks: number;
  visibility: TestCaseVisibility;
}

export interface TestCaseExecutionResult {
  testCaseId: string;
  status: SubmissionStatus;
  actualOutput?: string;
  expectedOutput?: string;
  executionTimeMs: number;
  memoryUsedKb?: number;
  marksAwarded: number;
  visibility: TestCaseVisibility;
  errorOutput?: string;
}

export interface ExecutionResult {
  language: ProgrammingLanguage;
  compileStatus: 'SUCCESS' | 'COMPILATION_ERROR';
  compileOutput?: string;
  testResults: TestCaseExecutionResult[];
  totalPassedTests: number;
  totalTests: number;
  score: number;
  maximumScore: number;
  submissionStatus: SubmissionStatus;
  totalExecutionTimeMs: number;
}

export interface CodeExecutionRequest {
  language: ProgrammingLanguage;
  sourceCode: string;
  testCases: TestCaseInput[];
  timeLimitMs?: number;
  memoryLimitKb?: number;
  isRunOnly?: boolean;
}
