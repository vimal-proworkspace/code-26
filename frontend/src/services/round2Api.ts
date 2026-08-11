import { apiFetch } from './api';

export interface BugDefinition {
  id: string;
  debuggingProblemId: string;
  bugId: string;
  title: string;
  description?: string;
  marks: number;
  validationConfig?: any;
  order: number;
  isActive: boolean;
}

export interface DebuggingProblem {
  id: string;
  roundId: string;
  title: string;
  description: string;
  buggyCode: string;
  solutionCode?: string;
  starterCode?: string;
  maximumMarks: number;
  timeLimit: number;
  memoryLimit: number;
  isActive: boolean;
  bugDefinitions?: BugDefinition[];
  _count?: { submissions: number };
}

export interface StudentRound2Data {
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
    buggyCode: string;
    savedCode: string;
    timeLimit: number;
    memoryLimit: number;
  };
}

export interface ExecutionRunResult {
  compileStatus: 'SUCCESS' | 'COMPILATION_ERROR';
  compileOutput: string;
  executionOutput: string;
  executionError: string;
  status: string;
  executionTimeMs: number;
}

export interface SubmissionResult {
  status: string;
  submissionId: string;
  submissionNumber: number;
  compileStatus: string;
  compileOutput: string;
  executionOutput: string;
  newlyFixedBugsCount: number;
  totalFixedBugsCount: number;
  newScorePoints: number;
  totalScore: number;
  maximumScore: number;
}

export interface DebuggingSubmission {
  id: string;
  studentId: string;
  debuggingProblemId: string;
  submittedCode: string;
  submissionNumber: number;
  compileStatus?: string;
  compileOutput?: string;
  executionOutput?: string;
  executionTime?: number;
  score: number;
  submittedAt: string;
  student?: {
    id: string;
    studentId: string;
    fullName: string;
    batchNumber: string;
  };
}

export interface Round2ScoreSummary {
  id: string;
  studentId: string;
  fullName: string;
  batchNumber: string;
  status: string;
  score: number;
  maximumScore: number;
  fixedBugsCount: number;
  submittedAt?: string | null;
}

export const round2Api = {
  // Admin APIs
  getAdminProblems: async (roundId: string): Promise<DebuggingProblem[]> => {
    const res = await apiFetch(`/api/round2/admin/rounds/${roundId}/problems`);
    return res.data;
  },

  createProblem: async (roundId: string, data: Partial<DebuggingProblem>): Promise<DebuggingProblem> => {
    const res = await apiFetch(`/api/round2/admin/rounds/${roundId}/problems`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.data;
  },

  updateProblem: async (problemId: string, data: Partial<DebuggingProblem>): Promise<DebuggingProblem> => {
    const res = await apiFetch(`/api/round2/admin/problems/${problemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.data;
  },

  deleteProblem: async (problemId: string): Promise<void> => {
    await apiFetch(`/api/round2/admin/problems/${problemId}`, {
      method: 'DELETE',
    });
  },

  createBugDefinition: async (problemId: string, data: Partial<BugDefinition>): Promise<BugDefinition> => {
    const res = await apiFetch(`/api/round2/admin/problems/${problemId}/bugs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.data;
  },

  updateBugDefinition: async (bugDefinitionId: string, data: Partial<BugDefinition>): Promise<BugDefinition> => {
    const res = await apiFetch(`/api/round2/admin/bugs/${bugDefinitionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.data;
  },

  deleteBugDefinition: async (bugDefinitionId: string): Promise<void> => {
    await apiFetch(`/api/round2/admin/bugs/${bugDefinitionId}`, {
      method: 'DELETE',
    });
  },

  getAdminSubmissions: async (problemId: string, studentId?: string): Promise<DebuggingSubmission[]> => {
    const query = studentId ? `?studentId=${encodeURIComponent(studentId)}` : '';
    const res = await apiFetch(`/api/round2/admin/problems/${problemId}/submissions${query}`);
    return res.data;
  },

  getRound2Scores: async (roundId: string): Promise<Round2ScoreSummary[]> => {
    const res = await apiFetch(`/api/round2/admin/rounds/${roundId}/scores`);
    return res.data;
  },

  // Student APIs
  getStudentRound2: async (roundId: string): Promise<StudentRound2Data> => {
    const res = await apiFetch(`/api/round2/rounds/${roundId}/student`);
    return res.data;
  },

  saveStudentCode: async (roundId: string, code: string): Promise<{ status: string; lastSavedAt: string }> => {
    const res = await apiFetch(`/api/round2/rounds/${roundId}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    return res.data;
  },

  runStudentCode: async (roundId: string, problemId: string, code: string, input?: string): Promise<ExecutionRunResult> => {
    const res = await apiFetch(`/api/round2/rounds/${roundId}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problemId, code, input }),
    });
    return res.data;
  },

  submitStudentCode: async (roundId: string, problemId: string, code: string): Promise<SubmissionResult> => {
    const res = await apiFetch(`/api/round2/rounds/${roundId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problemId, code }),
    });
    return res.data;
  },
};
