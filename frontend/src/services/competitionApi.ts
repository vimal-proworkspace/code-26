import { apiFetch } from './api';

export interface LeaderboardItem {
  rank: number;
  studentId: string;
  studentName: string;
  batchNumber: string;
  round1Score: number;
  round2Score: number;
  round3Score: number;
  totalScore: number;
  status: string;
}

export interface AdminLeaderboardResponse {
  eventId: string;
  showResults: boolean;
  leaderboard: LeaderboardItem[];
}

export interface StudentResultsResponse {
  showResults: boolean;
  myResult: LeaderboardItem | null;
  leaderboard: LeaderboardItem[];
}

export const competitionApi = {
  getAdminLeaderboard: async (): Promise<AdminLeaderboardResponse> => {
    const res = await apiFetch('/api/competition/leaderboard');
    return res.data;
  },

  getStudentResults: async (): Promise<StudentResultsResponse> => {
    const res = await apiFetch('/api/competition/results');
    return res.data;
  },

  toggleResultsVisibility: async (showResults: boolean): Promise<{ showResults: boolean }> => {
    const res = await apiFetch('/api/competition/visibility', {
      method: 'POST',
      body: JSON.stringify({ showResults }),
    });
    return res.data;
  },

  getAdminStudentInspection: async (studentId: string): Promise<any> => {
    const res = await apiFetch(`/api/competition/inspect/${studentId}`);
    return res.data;
  },
};
