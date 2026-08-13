import crypto from 'crypto';
import http from 'http';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { queryOne, execute, closePool } from '../config/database';
import { config } from '../config/env';
import { createApp } from '../app';
import { initSocketServer, broadcastRoundStarted, broadcastRoundPaused, broadcastRoundResumed, broadcastRoundEnded, broadcastRoundRestarted } from '../socket';
import { createAuthToken } from '../utils/jwt';
import { RoundStatus, RoundType, UserRole, DbUser, DbStudent, DbSession } from '../config/types';

async function runVerification() {
  console.log('=== STARTING REAL-TIME SOCKET.IO VERIFICATION TEST ===\n');

  let httpServer: http.Server | null = null;

  try {
    // 1. Setup Test HTTP + Socket.IO Server
    const app = createApp();
    httpServer = http.createServer(app);
    initSocketServer(httpServer);

    const TEST_PORT = 5055;
    await new Promise<void>((resolve) => httpServer!.listen(TEST_PORT, resolve));
    const SERVER_URL = `http://localhost:${TEST_PORT}`;

    console.log(`✓ Test Socket.IO server running on ${SERVER_URL}`);

    // 2. Fetch or create Admin and Student database records
    let adminUser = await queryOne<DbUser>(`SELECT * FROM users WHERE role = $1 LIMIT 1`, [UserRole.ADMIN]);
    if (!adminUser) {
      adminUser = await queryOne<DbUser>(
        `INSERT INTO users (id, username, "passwordHash", role, "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), 'admin@it.com', 'hash', 'ADMIN', true, NOW(), NOW())
         RETURNING *`
      );
    }

    let student = await queryOne<DbStudent>(`SELECT * FROM students WHERE "studentId" = 'SARA-001'`);
    if (!student) {
      let user = await queryOne<DbUser>(
        `INSERT INTO users (id, username, email, "passwordHash", role, "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), 'sara-001', 'sara001@sara.edu', 'hash', 'STUDENT', true, NOW(), NOW())
         RETURNING *`
      );
      student = await queryOne<DbStudent>(
        `INSERT INTO students (id, "userId", "studentId", "fullName", "batchNumber", status, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, 'SARA-001', 'Test Student 1', '284001', 'ACTIVE', NOW(), NOW())
         RETURNING *`,
        [user!.id]
      );
    }

    let studentUser = await queryOne<DbUser>(`SELECT * FROM users WHERE id = $1`, [student!.userId]);

    // Create database sessions for Auth
    const adminSession = await queryOne<DbSession>(
      `INSERT INTO sessions (id, "userId", "sessionToken", "createdAt", "expiresAt", "lastSeenAt")
       VALUES (gen_random_uuid(), $1, $2, NOW(), NOW() + interval '1 hour', NOW())
       RETURNING *`,
      [adminUser!.id, crypto.randomUUID()]
    );

    const studentSession = await queryOne<DbSession>(
      `INSERT INTO sessions (id, "userId", "sessionToken", "createdAt", "expiresAt", "lastSeenAt")
       VALUES (gen_random_uuid(), $1, $2, NOW(), NOW() + interval '1 hour', NOW())
       RETURNING *`,
      [studentUser!.id, crypto.randomUUID()]
    );

    const adminToken = createAuthToken({ userId: adminUser!.id, role: UserRole.ADMIN, sessionId: adminSession!.id });
    const studentToken = createAuthToken({ userId: studentUser!.id, role: UserRole.STUDENT, sessionId: studentSession!.id, studentId: student!.studentId });

    console.log('✓ Database sessions & JWT tokens generated for Admin and Student SARA-001.');

    // 3. Test Unauthorized Socket Connection Rejection
    const unauthSocket = ioClient(SERVER_URL, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: false,
    });

    const unauthRejected = await new Promise<boolean>((resolve) => {
      unauthSocket.on('connect_error', () => resolve(true));
      unauthSocket.on('connect', () => resolve(false));
      setTimeout(() => resolve(false), 2000);
    });

    unauthSocket.close();
    if (!unauthRejected) {
      throw new Error('SECURITY VIOLATION: Unauthorized socket connection was not rejected!');
    }
    console.log('✓ Unauthorized socket connection correctly rejected by socketAuth middleware.');

    // 4. Connect Authenticated Admin and Student Sockets
    const adminSocket: ClientSocket = ioClient(SERVER_URL, {
      auth: { token: adminToken },
      transports: ['websocket'],
    });

    const studentSocket: ClientSocket = ioClient(SERVER_URL, {
      auth: { token: studentToken },
      transports: ['websocket'],
    });

    await Promise.all([
      new Promise<void>((resolve) => adminSocket.on('connect', resolve)),
      new Promise<void>((resolve) => studentSocket.on('connect', resolve)),
    ]);

    console.log('✓ Admin socket & Student socket successfully connected & authenticated.');

    // 5. Test ROUND_STARTED Broadcast
    const testRoundId = 'test-socket-round-id';
    const testRoundName = 'Socket Sprint Round';

    const roundStartedPromise = new Promise<any>((resolve) => {
      studentSocket.on('ROUND_STARTED', (payload) => resolve(payload));
    });

    broadcastRoundStarted({
      id: testRoundId,
      name: testRoundName,
      type: RoundType.MCQ,
      duration: 30,
      startTime: new Date(),
      endTime: new Date(Date.now() + 1800000),
    });

    const startedPayload = await roundStartedPromise;
    if (startedPayload.roundId !== testRoundId || startedPayload.status !== 'LIVE') {
      throw new Error('ROUND_STARTED broadcast payload verification failed!');
    }
    console.log('✓ Student socket received ROUND_STARTED broadcast with server timestamps.');

    // 6. Test Late Joiner / Reconnect ROUND_STATE_SYNC
    const lateStudentSocket: ClientSocket = ioClient(SERVER_URL, {
      auth: { token: studentToken },
      transports: ['websocket'],
    });

    const stateSyncPromise = new Promise<any>((resolve) => {
      lateStudentSocket.on('ROUND_STATE_SYNC', (payload) => resolve(payload));
    });

    const syncPayload = await stateSyncPromise;
    lateStudentSocket.close();

    console.log('✓ Late-joining student received ROUND_STATE_SYNC:', {
      roundId: syncPayload.roundId,
      status: syncPayload.status,
    });

    // 7. Test ROUND_PAUSED Broadcast
    const roundPausedPromise = new Promise<any>((resolve) => {
      studentSocket.on('ROUND_PAUSED', (payload) => resolve(payload));
    });

    broadcastRoundPaused(testRoundId);
    const pausedPayload = await roundPausedPromise;
    if (pausedPayload.roundId !== testRoundId || pausedPayload.status !== 'PAUSED') {
      throw new Error('ROUND_PAUSED broadcast payload verification failed!');
    }
    console.log('✓ Student socket received ROUND_PAUSED broadcast.');

    // 8. Test ROUND_RESUMED Broadcast
    const roundResumedPromise = new Promise<any>((resolve) => {
      studentSocket.on('ROUND_RESUMED', (payload) => resolve(payload));
    });

    broadcastRoundResumed({
      id: testRoundId,
      endTime: new Date(Date.now() + 1200000),
    });

    const resumedPayload = await roundResumedPromise;
    if (resumedPayload.roundId !== testRoundId || resumedPayload.status !== 'LIVE') {
      throw new Error('ROUND_RESUMED broadcast payload verification failed!');
    }
    console.log('✓ Student socket received ROUND_RESUMED broadcast.');

    // 9. Test ROUND_ENDED Broadcast
    const roundEndedPromise = new Promise<any>((resolve) => {
      studentSocket.on('ROUND_ENDED', (payload) => resolve(payload));
    });

    broadcastRoundEnded(testRoundId, testRoundName);
    const endedPayload = await roundEndedPromise;
    if (endedPayload.roundId !== testRoundId || endedPayload.status !== 'ENDED') {
      throw new Error('ROUND_ENDED broadcast payload verification failed!');
    }
    console.log('✓ Student socket received ROUND_ENDED broadcast.');

    // 10. Test ROUND_RESTARTED Broadcast
    const roundRestartedPromise = new Promise<any>((resolve) => {
      studentSocket.on('ROUND_RESTARTED', (payload) => resolve(payload));
    });

    broadcastRoundRestarted(testRoundId);
    const restartedPayload = await roundRestartedPromise;
    if (restartedPayload.roundId !== testRoundId || restartedPayload.status !== 'READY') {
      throw new Error('ROUND_RESTARTED broadcast payload verification failed!');
    }
    console.log('✓ Student socket received ROUND_RESTARTED broadcast.');

    // Cleanup sockets and DB test sessions
    adminSocket.close();
    studentSocket.close();
    await execute(`DELETE FROM sessions WHERE id IN ($1, $2)`, [adminSession!.id, studentSession!.id]);

    console.log('\n=== REAL-TIME SOCKET.IO VERIFICATION SUCCESSFUL (ALL TESTS PASSED) ===');
  } catch (err: any) {
    console.error('❌ VERIFICATION FAILED:', err);
    process.exit(1);
  } finally {
    if (httpServer) {
      httpServer.close();
    }
    await closePool();
  }
}

runVerification();
