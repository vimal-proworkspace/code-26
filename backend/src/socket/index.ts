import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { config } from '../config/env';
import { queryOne } from '../config/database';
import { UserRole, DbRound, DbEvent } from '../config/types';
import { socketAuthMiddleware, AuthenticatedSocket } from './socketAuth';
import { ROOMS, RoomManager } from './roomManager';
import { SocketServerEvents, SocketClientEvents, RoundStatePayload, AdminEventUpdatePayload } from './socketEvents';
import { startDeadlineChecker } from './deadlineChecker';

let ioServer: SocketIOServer | null = null;

// Track online student IDs -> socket IDs set
const onlineStudentsMap = new Map<string, Set<string>>();

export const getIO = (): SocketIOServer => {
  if (!ioServer) {
    throw new Error('Socket.IO has not been initialized');
  }
  return ioServer;
};

export const initSocketServer = (httpServer: HttpServer): SocketIOServer => {
  const allowedOrigins = [config.frontendUrl, 'http://localhost:3000'].filter(Boolean);

  ioServer = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Apply authentication middleware
  ioServer.use((socket, next) => socketAuthMiddleware(socket as AuthenticatedSocket, next));

  ioServer.on('connection', async (rawSocket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const user = socket.data.user;

    if (!user) {
      socket.disconnect(true);
      return;
    }

    console.log(`[Socket] Connected: user=${user.userId}, role=${user.role}, socket=${socket.id}`);

    // Join admin or student room
    if (user.role === UserRole.ADMIN) {
      RoomManager.joinAdminRoom(socket);
    } else if (user.studentId) {
      RoomManager.joinStudentRoom(socket, user.studentId);

      // Track online student
      if (!onlineStudentsMap.has(user.studentId)) {
        onlineStudentsMap.set(user.studentId, new Set());
      }
      onlineStudentsMap.get(user.studentId)!.add(socket.id);

      // Join current event room if available
      const firstEvent = await queryOne<DbEvent>(`SELECT id FROM events ORDER BY "createdAt" ASC LIMIT 1`);
      if (firstEvent) {
        RoomManager.joinEventRoom(socket, firstEvent.id);
      }
    }

    // Immediately send current authoritative round state sync on connection/reconnect
    await sendRoundStateSync(socket);

    // Broadcast updated online metrics to admin
    broadcastAdminMetrics();

    // Client request handlers
    socket.on(SocketClientEvents.SYNC_TIME, () => {
      socket.emit(SocketServerEvents.SERVER_TIME_SYNC, {
        serverTime: new Date().toISOString(),
      });
    });

    socket.on(SocketClientEvents.JOIN_ROUND, (roundId: string) => {
      if (roundId) {
        RoomManager.joinRoundRoom(socket, roundId);
      }
    });

    socket.on(SocketClientEvents.LEAVE_ROUND, (roundId: string) => {
      if (roundId) {
        RoomManager.leaveRoundRoom(socket, roundId);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: user=${user.userId}, socket=${socket.id}`);

      if (user.studentId && onlineStudentsMap.has(user.studentId)) {
        const socketSet = onlineStudentsMap.get(user.studentId)!;
        socketSet.delete(socket.id);
        if (socketSet.size === 0) {
          onlineStudentsMap.delete(user.studentId);
        }
      }

      broadcastAdminMetrics();
    });
  });

  // Start background deadline checker
  startDeadlineChecker();

  return ioServer;
};

// ==========================================
// STATE SYNC HELPER FOR LATE JOIN / RECONNECT
// ==========================================

export const sendRoundStateSync = async (socket: AuthenticatedSocket) => {
  try {
    const liveRound = await queryOne<DbRound>(
      `SELECT * FROM rounds WHERE status IN ('LIVE', 'PAUSED') ORDER BY "order" ASC LIMIT 1`
    );

    const now = Date.now();
    let payload: RoundStatePayload;

    if (liveRound) {
      const endTimeMs = liveRound.endTime ? new Date(liveRound.endTime).getTime() : now;
      const remainingSeconds = Math.max(0, Math.floor((endTimeMs - now) / 1000));

      payload = {
        roundId: liveRound.id,
        roundName: liveRound.name,
        roundType: liveRound.type,
        status: liveRound.status as any,
        startTime: liveRound.startTime ? new Date(liveRound.startTime).toISOString() : null,
        endTime: liveRound.endTime ? new Date(liveRound.endTime).toISOString() : null,
        serverTime: new Date().toISOString(),
        duration: liveRound.duration,
        remainingSeconds,
      };
    } else {
      payload = {
        roundId: '',
        roundName: '',
        roundType: '',
        status: 'READY',
        serverTime: new Date().toISOString(),
        duration: 0,
        remainingSeconds: 0,
      };
    }

    socket.emit(SocketServerEvents.ROUND_STATE_SYNC, payload);
  } catch (err) {
    console.error('Error sending round state sync:', err);
  }
};

// ==========================================
// BROADCAST FUNCTIONS FOR SERVICES
// ==========================================

export const broadcastRoundStarted = (round: {
  id: string;
  name: string;
  type: string;
  duration: number;
  startTime?: Date | null;
  endTime?: Date | null;
}) => {
  if (!ioServer) return;

  const now = Date.now();
  const endTimeMs = round.endTime ? new Date(round.endTime).getTime() : now;
  const remainingSeconds = Math.max(0, Math.floor((endTimeMs - now) / 1000));

  const payload: RoundStatePayload = {
    roundId: round.id,
    roundName: round.name,
    roundType: round.type,
    status: 'LIVE',
    startTime: round.startTime ? new Date(round.startTime).toISOString() : new Date().toISOString(),
    endTime: round.endTime ? new Date(round.endTime).toISOString() : new Date().toISOString(),
    serverTime: new Date().toISOString(),
    duration: round.duration,
    remainingSeconds,
  };

  ioServer.emit(SocketServerEvents.ROUND_STARTED, payload);
  broadcastAdminMetrics();
};

export const broadcastRoundPaused = (roundId: string) => {
  if (!ioServer) return;

  ioServer.emit(SocketServerEvents.ROUND_PAUSED, {
    roundId,
    status: 'PAUSED',
    serverTime: new Date().toISOString(),
  });
  broadcastAdminMetrics();
};

export const broadcastRoundResumed = (round: { id: string; endTime?: Date | null }) => {
  if (!ioServer) return;

  const now = Date.now();
  const endTimeMs = round.endTime ? new Date(round.endTime).getTime() : now;
  const remainingSeconds = Math.max(0, Math.floor((endTimeMs - now) / 1000));

  ioServer.emit(SocketServerEvents.ROUND_RESUMED, {
    roundId: round.id,
    status: 'LIVE',
    endTime: round.endTime ? new Date(round.endTime).toISOString() : null,
    serverTime: new Date().toISOString(),
    remainingSeconds,
  });
  broadcastAdminMetrics();
};

export const broadcastRoundEnded = (roundId: string, roundName?: string) => {
  if (!ioServer) return;

  ioServer.emit(SocketServerEvents.ROUND_ENDED, {
    roundId,
    roundName,
    status: 'ENDED',
    serverTime: new Date().toISOString(),
  });
  broadcastAdminMetrics();
};

export const broadcastRoundRestarted = (roundId: string) => {
  if (!ioServer) return;

  ioServer.emit(SocketServerEvents.ROUND_RESTARTED, {
    roundId,
    status: 'READY',
    serverTime: new Date().toISOString(),
  });
  broadcastAdminMetrics();
};

export const notifyAdminViolation = (violation: {
  studentId: string;
  studentName?: string;
  violationType: string;
  count: number;
  maximumAllowed: number;
}) => {
  if (!ioServer) return;

  ioServer.to(ROOMS.ADMIN).emit(SocketServerEvents.VIOLATION_RECORDED, {
    ...violation,
    timestamp: new Date().toISOString(),
  });
};

export const notifyAdminSubmission = (submission: {
  roundId: string;
  studentId: string;
  studentName?: string;
  submissionType: string;
  score?: number;
}) => {
  if (!ioServer) return;

  ioServer.to(ROOMS.ADMIN).emit(SocketServerEvents.SUBMISSION_STATUS, {
    ...submission,
    timestamp: new Date().toISOString(),
  });
};

export const broadcastAdminMetrics = async () => {
  if (!ioServer) return;

  try {
    const totalStudentsRes = await queryOne<{ count: string }>(`SELECT COUNT(*) FROM students`);
    const totalStudents = parseInt(totalStudentsRes?.count || '0', 10);
    const onlineCount = onlineStudentsMap.size;
    const offlineCount = Math.max(0, totalStudents - onlineCount);

    const activeRound = await queryOne<DbRound>(
      `SELECT * FROM rounds WHERE status IN ('LIVE', 'PAUSED') LIMIT 1`
    );

    const payload: AdminEventUpdatePayload = {
      totalStudents,
      onlineCount,
      offlineCount,
      activeRoundId: activeRound ? activeRound.id : null,
      activeRoundStatus: activeRound ? activeRound.status as any : null,
      serverTime: new Date().toISOString(),
    };

    ioServer.to(ROOMS.ADMIN).emit(SocketServerEvents.ADMIN_EVENT_UPDATE, payload);
  } catch (err) {
    console.error('Error broadcasting admin metrics:', err);
  }
};

export const isStudentOnline = (studentId: string): boolean => {
  return onlineStudentsMap.has(studentId) && (onlineStudentsMap.get(studentId)?.size || 0) > 0;
};

export const getOnlineStudentIds = (): string[] => {
  return Array.from(onlineStudentsMap.keys());
};
