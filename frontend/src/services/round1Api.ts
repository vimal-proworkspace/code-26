const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:4000';

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Round 1 API request failed');
  }
  return data.data as T;
}

export interface QuestionOption {
  id?: string;
  questionId?: string;
  optionKey: string;
  optionText: string;
  order: number;
}

export interface AdminQuestion {
  id: string;
  roundId: string;
  questionText: string;
  questionType: 'MCQ' | 'MULTIPLE_CHOICE' | 'OUTPUT_PREDICTION';
  marks: number;
  negativeMarks: number;
  order: number;
  isActive: boolean;
  correctAnswer?: string;
  code?: string;
  correctOutput?: string;
  comparisonMethod?: 'EXACT' | 'EXACT_IGNORE_CASE' | 'TRIM' | 'REGEX';
  options: QuestionOption[];
  _count?: {
    studentAnswers: number;
  };
}

export interface StudentSanitizedQuestion {
  id: string;
  roundId: string;
  questionText: string;
  questionType: 'MCQ' | 'MULTIPLE_CHOICE' | 'OUTPUT_PREDICTION';
  code?: string;
  marks: number;
  negativeMarks: number;
  order: number;
  options: QuestionOption[];
}

export interface StudentQuizResponse {
  isSubmitted: boolean;
  submittedAt?: string;
  score?: number;
  maximumScore?: number;
  message?: string;
  round?: {
    id: string;
    name: string;
    duration: number;
    remainingSeconds: number;
    endTime?: string;
  };
  questions?: StudentSanitizedQuestion[];
  savedAnswers?: { questionId: string; answer: string }[];
}

export interface SubmitRound1Response {
  status: string;
  score: number;
  maximumScore: number;
  submittedAt: string;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
}

export interface AdminInspectionResponse {
  student: {
    id: string;
    studentId: string;
    fullName: string;
    batchNumber: string;
  };
  score: number;
  maximumScore: number;
  submissionStatus: string;
  submittedAt?: string;
  questions: {
    questionId: string;
    questionText: string;
    questionType: string;
    code?: string;
    marks: number;
    negativeMarks: number;
    correctAnswer?: string;
    correctOutput?: string;
    comparisonMethod?: string;
    studentAnswer: string;
    isCorrect: boolean;
    marksAwarded: number;
    options: QuestionOption[];
  }[];
}

export interface StudentScoreSummary {
  id: string;
  studentId: string;
  fullName: string;
  batchNumber: string;
  status: string;
  score: number;
  maximumScore: number;
  submittedAt?: string;
}

export const round1Api = {
  // Admin Question CRUD
  async getAdminQuestions(roundId: string): Promise<AdminQuestion[]> {
    const res = await fetch(`${API_BASE_URL}/api/round1/admin/questions/${roundId}`, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse<AdminQuestion[]>(res);
  },

  async createQuestion(
    roundId: string,
    data: {
      questionText: string;
      questionType: 'MCQ' | 'OUTPUT_PREDICTION';
      marks: number;
      negativeMarks?: number;
      correctAnswer?: string;
      code?: string;
      correctOutput?: string;
      comparisonMethod?: 'EXACT' | 'TRIM' | 'EXACT_IGNORE_CASE';
      options?: { optionKey: string; optionText: string; order: number }[];
    }
  ): Promise<AdminQuestion> {
    const res = await fetch(`${API_BASE_URL}/api/round1/admin/questions/${roundId}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<AdminQuestion>(res);
  },

  async updateQuestion(
    id: string,
    data: {
      questionText?: string;
      questionType?: 'MCQ' | 'OUTPUT_PREDICTION';
      marks?: number;
      negativeMarks?: number;
      isActive?: boolean;
      correctAnswer?: string;
      code?: string;
      correctOutput?: string;
      comparisonMethod?: 'EXACT' | 'TRIM' | 'EXACT_IGNORE_CASE';
      options?: { optionKey: string; optionText: string; order: number }[];
    }
  ): Promise<AdminQuestion> {
    const res = await fetch(`${API_BASE_URL}/api/round1/admin/questions/${id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<AdminQuestion>(res);
  },

  async deleteQuestion(id: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/round1/admin/questions/${id}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse<{ message: string }>(res);
  },

  async reorderQuestions(roundId: string, orderedQuestionIds: string[]): Promise<AdminQuestion[]> {
    const res = await fetch(`${API_BASE_URL}/api/round1/admin/questions/${roundId}/reorder`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedQuestionIds }),
    });
    return handleResponse<AdminQuestion[]>(res);
  },

  async toggleQuestion(id: string, isActive: boolean): Promise<AdminQuestion> {
    const res = await fetch(`${API_BASE_URL}/api/round1/admin/questions/${id}/toggle`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    });
    return handleResponse<AdminQuestion>(res);
  },

  // Admin Inspection
  async getStudentAnswers(roundId: string, studentId: string): Promise<AdminInspectionResponse> {
    const res = await fetch(`${API_BASE_URL}/api/round1/admin/inspection/${roundId}/student/${studentId}`, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse<AdminInspectionResponse>(res);
  },

  async getRound1Scores(roundId: string): Promise<StudentScoreSummary[]> {
    const res = await fetch(`${API_BASE_URL}/api/round1/admin/scores/${roundId}`, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse<StudentScoreSummary[]>(res);
  },

  // Student Live Quiz APIs
  async getStudentQuiz(roundId: string): Promise<StudentQuizResponse> {
    const res = await fetch(`${API_BASE_URL}/api/round1/student/quiz/${roundId}`, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse<StudentQuizResponse>(res);
  },

  async saveAnswer(roundId: string, questionId: string, answer: string): Promise<{ status: string; questionId: string; answer: string }> {
    const res = await fetch(`${API_BASE_URL}/api/round1/student/answer`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roundId, questionId, answer }),
    });
    return handleResponse<{ status: string; questionId: string; answer: string }>(res);
  },

  async submitRound1(roundId: string): Promise<SubmitRound1Response> {
    const res = await fetch(`${API_BASE_URL}/api/round1/student/submit`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roundId }),
    });
    return handleResponse<SubmitRound1Response>(res);
  },
};
