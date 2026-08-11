import { apiFetch } from './api';

export interface TestCase {
  id: string;
  programmingProblemId: string;
  input: string;
  expectedOutput: string;
  marks: number;
  visibility: 'VISIBLE' | 'HIDDEN';
  order: number;
  isActive: boolean;
}

export interface ProgrammingProblem {
  id: string;
  roundId: string;
  title: string;
  description: string;
  inputFormat?: string;
  outputFormat?: string;
  constraints?: string;
  examples?: any;
  starterCode?: string;
  supportedLanguages: string[];
  maximumMarks: number;
  timeLimit: number;
  memoryLimit: number;
  isActive: boolean;
  testCases?: TestCase[];
  _count?: { submissions: number };
}

export interface StudentRound3Data {
  isSubmitted: boolean;
  submittedAt?: string | null;
  round: {
    id: string;
    name: string;
    duration: number;
    remainingSeconds: number;
    endTime?: string | null;
  };
  problem: {
    id: string;
    title: string;
    description: string;
    inputFormat?: string;
    outputFormat?: string;
    constraints?: string;
    examples?: any;
    starterCode?: string;
    supportedLanguages: string[];
    maximumMarks: number;
    timeLimit: number;
    visibleTestCases: {
      id: string;
      input: string;
      expectedOutput: string;
      marks: number;
      order: number;
    }[];
    savedCodeMap?: Record<string, string>;
  };
}

export interface ExecutionRunResult {
  compileStatus: 'SUCCESS' | 'COMPILATION_ERROR';
  compileOutput: string;
  visibleTestResults: {
    testCaseId: string;
    status: string;
    actualOutput?: string;
    expectedOutput?: string;
    executionTimeMs: number;
    marksAwarded: number;
    visibility: string;
  }[];
  totalPassedTests: number;
  totalTests: number;
  status: string;
  executionTimeMs: number;
}

export interface SubmissionResult {
  status: string;
  submissionId: string;
  submissionNumber: number;
  compileStatus: string;
  compileOutput: string;
  submissionStatus: string;
  passedTests: number;
  totalTests: number;
  score: number;
  maximumScore: number;
  testResults: {
    testCaseId: string;
    status: string;
    visibility: 'VISIBLE' | 'HIDDEN';
    actualOutput?: string;
    expectedOutput?: string;
    executionTimeMs: number;
    marksAwarded: number;
  }[];
}

export interface ProgrammingSubmission {
  id: string;
  studentId: string;
  programmingProblemId: string;
  language: string;
  submittedCode: string;
  submissionNumber: number;
  compileStatus?: string;
  compileOutput?: string;
  executionOutput?: string;
  passedTests: number;
  totalTests: number;
  score: number;
  submissionStatus: string;
  submittedAt: string;
  student?: {
    id: string;
    studentId: string;
    fullName: string;
    batchNumber: string;
  };
}

export interface Round3ScoreSummary {
  id: string;
  studentId: string;
  fullName: string;
  batchNumber: string;
  status: string;
  score: number;
  maximumScore: number;
  submittedAt?: string | null;
}

export const round3Api = {
  // Admin APIs
  getAdminProblems: async (roundId: string): Promise<ProgrammingProblem[]> => {
    const res = await apiFetch(`/api/round3/admin/rounds/${roundId}/problems`);
    return res.data;
  },

  createProblem: async (roundId: string, data: Partial<ProgrammingProblem>): Promise<ProgrammingProblem> => {
    const res = await apiFetch(`/api/round3/admin/rounds/${roundId}/problems`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.data;
  },

  updateProblem: async (problemId: string, data: Partial<ProgrammingProblem>): Promise<ProgrammingProblem> => {
    const res = await apiFetch(`/api/round3/admin/problems/${problemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.data;
  },

  deleteProblem: async (problemId: string): Promise<void> => {
    await apiFetch(`/api/round3/admin/problems/${problemId}`, {
      method: 'DELETE',
    });
  },

  createTestCase: async (problemId: string, data: Partial<TestCase>): Promise<TestCase> => {
    const res = await apiFetch(`/api/round3/admin/problems/${problemId}/testcases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.data;
  },

  updateTestCase: async (testCaseId: string, data: Partial<TestCase>): Promise<TestCase> => {
    const res = await apiFetch(`/api/round3/admin/testcases/${testCaseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.data;
  },

  deleteTestCase: async (testCaseId: string): Promise<void> => {
    await apiFetch(`/api/round3/admin/testcases/${testCaseId}`, {
      method: 'DELETE',
    });
  },

  getAdminSubmissions: async (problemId: string, studentId?: string): Promise<ProgrammingSubmission[]> => {
    const query = studentId ? `?studentId=${encodeURIComponent(studentId)}` : '';
    const res = await apiFetch(`/api/round3/admin/problems/${problemId}/submissions${query}`);
    return res.data;
  },

  getRound3Scores: async (roundId: string): Promise<Round3ScoreSummary[]> => {
    const res = await apiFetch(`/api/round3/admin/rounds/${roundId}/scores`);
    return res.data;
  },

  // Student APIs
  getStudentRound3: async (roundId: string): Promise<StudentRound3Data> => {
    const res = await apiFetch(`/api/round3/rounds/${roundId}/student`);
    return res.data;
  },

  saveStudentCode: async (roundId: string, language: string, code: string): Promise<{ status: string; lastSavedAt: string }> => {
    const res = await apiFetch(`/api/round3/rounds/${roundId}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language, code }),
    });
    return res.data;
  },

  runStudentCode: async (roundId: string, problemId: string, language: string, code: string): Promise<ExecutionRunResult> => {
    const res = await apiFetch(`/api/round3/rounds/${roundId}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problemId, language, code }),
    });
    return res.data;
  },

  submitStudentCode: async (roundId: string, problemId: string, language: string, code: string): Promise<SubmissionResult> => {
    const res = await apiFetch(`/api/round3/rounds/${roundId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problemId, language, code }),
    });
    return res.data;
  },
};
