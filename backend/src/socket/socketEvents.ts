export enum SocketServerEvents {
  ROUND_STARTED = 'ROUND_STARTED',
  ROUND_PAUSED = 'ROUND_PAUSED',
  ROUND_RESUMED = 'ROUND_RESUMED',
  ROUND_ENDED = 'ROUND_ENDED',
  ROUND_RESTARTED = 'ROUND_RESTARTED',
  ROUND_STATE_SYNC = 'ROUND_STATE_SYNC',
  SERVER_TIME_SYNC = 'SERVER_TIME_SYNC',
  STUDENT_STATUS_CHANGED = 'STUDENT_STATUS_CHANGED',
  VIOLATION_RECORDED = 'VIOLATION_RECORDED',
  SUBMISSION_STATUS = 'SUBMISSION_STATUS',
  ADMIN_EVENT_UPDATE = 'ADMIN_EVENT_UPDATE',
}

export enum SocketClientEvents {
  CLIENT_IDENTIFY = 'socket:identify',
  JOIN_EVENT = 'socket:join-event',
  JOIN_ROUND = 'socket:join-round',
  LEAVE_ROUND = 'socket:leave-round',
  SYNC_TIME = 'socket:sync-time',
}

export interface RoundStatePayload {
  roundId: string;
  roundName: string;
  roundType: string;
  status: 'DRAFT' | 'READY' | 'LIVE' | 'PAUSED' | 'ENDED';
  startTime?: string | null;
  endTime?: string | null;
  serverTime: string;
  duration: number;
  remainingSeconds: number;
}

export interface ViolationPayload {
  studentId: string;
  studentName?: string;
  violationType: string;
  timestamp: string;
  count: number;
  maximumAllowed: number;
}

export interface SubmissionPayload {
  roundId: string;
  studentId: string;
  studentName?: string;
  submissionType: string;
  score?: number;
  timestamp: string;
}

export interface AdminEventUpdatePayload {
  totalStudents: number;
  onlineCount: number;
  offlineCount: number;
  activeRoundId?: string | null;
  activeRoundStatus?: string | null;
  serverTime: string;
}
