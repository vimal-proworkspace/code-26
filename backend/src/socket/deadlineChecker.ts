import { RoundStatus, RoundProgressStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { broadcastRoundEnded } from './index';

let deadlineInterval: NodeJS.Timeout | null = null;
let isChecking = false;

export const startDeadlineChecker = () => {
  if (deadlineInterval) return;

  deadlineInterval = setInterval(async () => {
    if (isChecking) return;
    isChecking = true;

    try {
      const now = new Date();

      // Find LIVE rounds whose deadline has passed
      const expiredRounds = await prisma.round.findMany({
        where: {
          status: RoundStatus.LIVE,
          endTime: { lte: now },
        },
      });

      for (const round of expiredRounds) {
        console.log(`[DeadlineChecker] Round ${round.name} (${round.id}) deadline reached. Auto-ending round...`);

        // Atomically update round status to ENDED
        const updatedRound = await prisma.round.update({
          where: { id: round.id },
          data: { status: RoundStatus.ENDED },
        });

        // Mark IN_PROGRESS progress records as SUBMITTED (idempotently)
        await prisma.roundProgress.updateMany({
          where: {
            roundId: round.id,
            status: RoundProgressStatus.IN_PROGRESS,
          },
          data: {
            status: RoundProgressStatus.SUBMITTED,
            submittedAt: now,
          },
        });

        // Log audit record
        await prisma.auditLog.create({
          data: {
            action: 'ROUND_AUTO_ENDED_DEADLINE',
            entity: 'Round',
            entityId: round.id,
            metadata: { name: round.name, endTime: round.endTime },
          },
        });

        // Broadcast ROUND_ENDED via Socket.IO
        broadcastRoundEnded(updatedRound.id, updatedRound.name);
      }
    } catch (err) {
      console.error('[DeadlineChecker] Error checking round deadlines:', err);
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
