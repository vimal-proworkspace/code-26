const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:4000';

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Admin API request failed');
  }
  return data.data as T;
}

export interface AdminRound {
  id: string;
  eventId: string;
  name: string;
  type: 'MCQ' | 'OUTPUT_PREDICTION' | 'DEBUGGING' | 'PROGRAMMING';
  description?: string;
  order: number;
  duration: number;
  maximumMarks: number;
  status: 'DRAFT' | 'READY' | 'LIVE' | 'PAUSED' | 'ENDED';
  isEnabled: boolean;
  startTime?: string;
  endTime?: string;
  remainingSeconds?: number;
  _count?: {
    questions: number;
    debuggingProblems: number;
    programmingProblems: number;
    progresses: number;
    scores: number;
  };
}

export interface AdminRoundsResponse {
  event: {
    id: string;
    name: string;
    status: string;
  };
  rounds: AdminRound[];
}

export const adminApi = {
  async getRounds(): Promise<AdminRoundsResponse> {
    const res = await fetch(`${API_BASE_URL}/api/admin/rounds`, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse<AdminRoundsResponse>(res);
  },

  async getRound(id: string): Promise<AdminRound> {
    const res = await fetch(`${API_BASE_URL}/api/admin/rounds/${id}`, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse<AdminRound>(res);
  },

  async createRound(data: {
    name: string;
    type: 'MCQ' | 'OUTPUT_PREDICTION' | 'DEBUGGING' | 'PROGRAMMING';
    description?: string;
    duration: number;
    maximumMarks: number;
    isEnabled?: boolean;
  }): Promise<AdminRound> {
    const res = await fetch(`${API_BASE_URL}/api/admin/rounds`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<AdminRound>(res);
  },

  async updateRound(
    id: string,
    data: {
      name?: string;
      type?: 'MCQ' | 'OUTPUT_PREDICTION' | 'DEBUGGING' | 'PROGRAMMING';
      description?: string;
      duration?: number;
      maximumMarks?: number;
      isEnabled?: boolean;
    }
  ): Promise<AdminRound> {
    const res = await fetch(`${API_BASE_URL}/api/admin/rounds/${id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<AdminRound>(res);
  },

  async deleteRound(id: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/admin/rounds/${id}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse<{ message: string }>(res);
  },

  async reorderRounds(orderedRoundIds: string[]): Promise<AdminRoundsResponse> {
    const res = await fetch(`${API_BASE_URL}/api/admin/rounds/reorder`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedRoundIds }),
    });
    return handleResponse<AdminRoundsResponse>(res);
  },

  async toggleRound(id: string, isEnabled: boolean): Promise<AdminRound> {
    const res = await fetch(`${API_BASE_URL}/api/admin/rounds/${id}/toggle`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isEnabled }),
    });
    return handleResponse<AdminRound>(res);
  },

  async startRound(id: string): Promise<AdminRound> {
    const res = await fetch(`${API_BASE_URL}/api/admin/rounds/${id}/start`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse<AdminRound>(res);
  },

  async pauseRound(id: string): Promise<AdminRound> {
    const res = await fetch(`${API_BASE_URL}/api/admin/rounds/${id}/pause`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse<AdminRound>(res);
  },

  async resumeRound(id: string): Promise<AdminRound> {
    const res = await fetch(`${API_BASE_URL}/api/admin/rounds/${id}/resume`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse<AdminRound>(res);
  },

  async endRound(id: string): Promise<AdminRound> {
    const res = await fetch(`${API_BASE_URL}/api/admin/rounds/${id}/end`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse<AdminRound>(res);
  },

  async restartRound(id: string, reason?: string): Promise<AdminRound> {
    const res = await fetch(`${API_BASE_URL}/api/admin/rounds/${id}/restart`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    return handleResponse<AdminRound>(res);
  },
};

