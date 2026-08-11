import { apiFetch } from './api';

export interface StudentListItem {
  id: string;
  userId: string;
  studentId: string;
  fullName: string;
  batchNumber: string;
  accountActive: boolean;
  isOnline: boolean;
  activityStatus: string;
  isLocked: boolean;
  violationCount: number;
  totalScore: number;
  rank?: number | null;
  currentRound?: {
    id: string;
    name: string;
    type: string;
    status: string;
  } | null;
  lastActivityAt: string;
  submissionAt?: string | null;
}

export interface StudentListResponse {
  students: StudentListItem[];
  pagination: {
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  summary: {
    totalStudents: number;
    onlineCount: number;
    offlineCount: number;
    workingCount: number;
    submittedCount: number;
    lockedCount: number;
    withViolationsCount: number;
  };
}

export interface StudentDetailResponse {
  studentInfo: {
    id: string;
    studentId: string;
    fullName: string;
    batchNumber: string;
    email: string | null;
    username: string;
    accountActive: boolean;
    createdAt: string;
    isOnline: boolean;
  };
  overall: {
    totalScore: number;
    rank?: number | null;
    violationCount: number;
    maximumAllowedViolations: number;
    isLocked: boolean;
  };
  round1: {
    status: string;
    score: number;
    maximumScore: number;
    submittedAt?: string | null;
    totalQuestions: number;
    answeredCount: number;
    answers: Array<{
      questionId: string;
      questionText: string;
      questionType: string;
      code?: string | null;
      marks: number;
      negativeMarks: number;
      studentAnswer: string;
      correctAnswer: string;
      options: any[];
      isCorrect: boolean;
      answeredAt?: string | null;
    }>;
  };
  round2: {
    status: string;
    score: number;
    maximumScore: number;
    currentDraftCode?: string | null;
    lastSavedAt?: string | null;
    submissions: Array<{
      submissionIndex: number;
      id: string;
      problemTitle: string;
      submittedCode: string;
      compileStatus: string;
      compileOutput?: string | null;
      executionOutput?: string | null;
      bugsFixedCount: number;
      awardedMarks: number;
      timestamp: string;
    }>;
  };
  round3: {
    status: string;
    score: number;
    maximumScore: number;
    savedCodeMap: Record<string, string>;
    lastSavedAt?: string | null;
    submissions: Array<{
      submissionIndex: number;
      id: string;
      problemTitle: string;
      language: string;
      submittedCode: string;
      compileStatus: string;
      compileOutput?: string | null;
      passedTestsCount: number;
      totalTestsCount: number;
      executionTimeMs: number;
      score: number;
      status: string;
      timestamp: string;
    }>;
  };
  violations: Array<{
    id: string;
    type: string;
    details?: string | null;
    roundName: string;
    timestamp: string;
  }>;
  activityLogs: Array<{
    id: string;
    action: string;
    entity: string;
    metadata: any;
    timestamp: string;
  }>;
}

export const adminStudentApi = {
  getStudentsList: async (params?: {
    search?: string;
    statusFilter?: string;
    roundId?: string;
    batchNumber?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<StudentListResponse> => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.statusFilter) query.append('statusFilter', params.statusFilter);
    if (params?.roundId) query.append('roundId', params.roundId);
    if (params?.batchNumber) query.append('batchNumber', params.batchNumber);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.sortBy) query.append('sortBy', params.sortBy);
    if (params?.sortOrder) query.append('sortOrder', params.sortOrder);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    const res = await apiFetch(`/api/admin/students${queryString}`);
    return res.data;
  },

  getStudentDetail: async (studentId: string): Promise<StudentDetailResponse> => {
    const res = await apiFetch(`/api/admin/students/${studentId}`);
    return res.data;
  },

  toggleStudentAccount: async (studentId: string, isActive: boolean) => {
    const res = await apiFetch(`/api/admin/students/${studentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    });
    return res.data;
  },
};
