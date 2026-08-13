import { query, queryOne, execute } from '../config/database';
import { DbRound } from '../config/types';
import { broadcastRoundEnded } from './index';

let deadlineInterval: NodeJS.Timeout | null = null;
let isChecking = false;
let lastErrorMsg = '';
let lastErrorTimestamp = 0;

export const startDeadlineChecker = () => {
  if (deadlineInterval) return;

  deadlineInterval = setInterval(async () => {
    if (isChecking) return;
    isChecking = true;

    try {
      const now = new Date();

      // Find LIVE rounds whose deadline has passed
      const expiredRounds = await query<DbRound>(
        `SELECT * FROM rounds WHERE status = 'LIVE' AND "endTime" <= $1`,
        [now]
      );

      for (const round of expiredRounds) {
        console.log(`[DeadlineChecker] Round ${round.name} (${round.id}) deadline reached. Auto-ending round...`);

        // Atomically update round status to ENDED
        const updatedRound = await queryOne<DbRound>(
          `UPDATE rounds SET status = 'ENDED', "updatedAt" = NOW() WHERE id = $1 RETURNING *`,
          [round.id]
        );

        // Mark IN_PROGRESS progress records as SUBMITTED (idempotently)
        await execute(
          `UPDATE round_progress
           SET status = 'SUBMITTED', "submittedAt" = $1
           WHERE "roundId" = $2 AND status = 'IN_PROGRESS'`,
          [now, round.id]
        );

        // Log audit record
        await query(
          `INSERT INTO audit_logs (id, action, entity, "entityId", metadata, "createdAt")
           VALUES (gen_random_uuid(), 'ROUND_AUTO_ENDED_DEADLINE', 'Round', $1, $2, NOW())`,
          [round.id, JSON.stringify({ name: round.name, endTime: round.endTime })]
        );

        // Broadcast ROUND_ENDED via Socket.IO
        if (updatedRound) {
          broadcastRoundEnded(updatedRound.id, updatedRound.name);
        }
      }
      // Reset error state on success
      lastErrorMsg = '';
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const currentTime = Date.now();
      if (msg !== lastErrorMsg || currentTime - lastErrorTimestamp > 60000) {
        console.error('[DeadlineChecker] Database check issue (throttled):', msg);
        lastErrorMsg = msg;
        lastErrorTimestamp = currentTime;
      }
    } finally {
      isChecking = false;
    }
  }, 2000);
};

export const stopDeadlineChecker = () => {
  if (deadlineInterval) {
    clearInterval(deadlineInterval);
    deadlineInterval = null;
  }
};
