import { apiFetch } from './api';

export interface ViolationStatusResponse {
  violationCount: number;
  maximumAllowed: number;
  isLocked: boolean;
  activeRound?: {
    id: string;
    name: string;
    status: string;
  } | null;
}

export interface AdminViolationOverviewResponse {
  maximumAllowed: number;
  totalViolations: number;
  lockedCount: number;
  lockedStudents: Array<{
    studentDbId: string;
    studentId: string;
    fullName: string;
    batchNumber: string;
    roundName: string;
    lockedAt: string | null;
  }>;
  recentViolations: Array<{
    id: string;
    studentId: string;
    studentName: string;
    batchNumber: string;
    roundName: string;
    type: string;
    details: string | null;
    timestamp: string;
  }>;
}

export const violationApi = {
  recordViolation: async (violationType: string, details?: string) => {
    const res = await apiFetch('/api/violations', {
      method: 'POST',
      body: JSON.stringify({ violationType, details }),
    });
    return res.data;
  },

  getViolationStatus: async (): Promise<ViolationStatusResponse> => {
    const res = await apiFetch('/api/violations/status');
    return res.data;
  },

  invigilatorUnlock: async (password: string, studentUserId?: string) => {
    const res = await apiFetch('/api/violations/unlock', {
      method: 'POST',
      body: JSON.stringify({ password, studentUserId }),
    });
    return res.data;
  },

  getAdminViolationOverview: async (): Promise<AdminViolationOverviewResponse> => {
    const res = await apiFetch('/api/violations/admin/overview');
    return res.data;
  },
};
