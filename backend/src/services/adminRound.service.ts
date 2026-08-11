import { RoundType, RoundStatus, UserRole } from '@prisma/client';
import { prisma } from '../config/database';
import {
  broadcastRoundStarted,
  broadcastRoundPaused,
  broadcastRoundResumed,
  broadcastRoundEnded,
  broadcastRoundRestarted,
} from '../socket';

export interface CreateRoundInput {
  name: string;
  type: RoundType;
  description?: string;
  duration: number; // in minutes
  maximumMarks: number;
  order?: number;
  isEnabled?: boolean;
  eventId?: string;
}

export interface UpdateRoundInput {
  name?: string;
  type?: RoundType;
  description?: string;
  duration?: number;
  maximumMarks?: number;
  order?: number;
  isEnabled?: boolean;
  status?: RoundStatus;
}

export class AdminRoundService {
  /**
   * Writes audit log entry for admin actions safely.
   */
  private async logAudit(action: string, roundId: string, userId?: string, metadata?: Record<string, unknown>) {
    try {
      await prisma.auditLog.create({
        data: {
          action,
          entity: 'Round',
          entityId: roundId,
          userId,
          metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
        },
      });
    } catch (err) {
      console.error('Failed to create admin audit log entry:', err);
    }
  }

  /**
   * Helper to retrieve primary event ID if not explicitly specified.
   */
  private async getPrimaryEventId(): Promise<string> {
    const event = await prisma.event.findFirst();
    if (!event) {
      const newEvent = await prisma.event.create({
        data: {
          id: 'coding-challenge-2026-event-id',
          name: 'Coding Challenge 2026',
          status: 'DRAFT',
        },
      });
      return newEvent.id;
    }
    return event.id;
  }

  /**
   * Retrieves all rounds ordered by 'order' index ascending.
   */
  public async getRounds() {
    const eventId = await this.getPrimaryEventId();
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        settings: true,
        visibility: true,
      },
    });

    const rounds = await prisma.round.findMany({
      where: { eventId },
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: {
            questions: true,
            debuggingProblems: true,
            programmingProblems: true,
            progresses: true,
            scores: true,
          },
        },
      },
    });

    return {
      event,
      rounds,
    };
  }

  /**
   * Retrieves a single round by ID.
   */
  public async getRoundById(id: string) {
    const round = await prisma.round.findUnique({
      where: { id },
      include: {
        questions: { orderBy: { order: 'asc' } },
        debuggingProblems: true,
        programmingProblems: true,
        _count: {
          select: {
            progresses: true,
            scores: true,
          },
        },
      },
    });

    if (!round) {
      throw { statusCode: 404, message: 'Round not found' };
    }

    return round;
  }

  /**
   * Creates a new round with assigned order index.
   */
  public async createRound(input: CreateRoundInput, userId?: string) {
    const name = (input.name || '').trim();
    if (!name) {
      throw { statusCode: 400, message: 'Round name is required' };
    }
    if (!input.type) {
      throw { statusCode: 400, message: 'Round type is required' };
    }
    if (!input.duration || input.duration <= 0) {
      throw { statusCode: 400, message: 'Duration must be greater than 0 minutes' };
    }
    if (!input.maximumMarks || input.maximumMarks <= 0) {
      throw { statusCode: 400, message: 'Maximum marks must be greater than 0' };
    }

    const eventId = input.eventId || (await this.getPrimaryEventId());

    // Determine next order if not specified
    let order = input.order;
    if (order === undefined || order === null) {
      const highestRound = await prisma.round.findFirst({
        where: { eventId },
        orderBy: { order: 'desc' },
      });
      order = (highestRound?.order || 0) + 1;
    }

    const round = await prisma.round.create({
      data: {
        eventId,
        name,
        type: input.type,
        description: input.description,
        duration: input.duration,
        maximumMarks: input.maximumMarks,
        order,
        isEnabled: input.isEnabled !== undefined ? input.isEnabled : true,
        status: RoundStatus.DRAFT,
      },
    });

    await this.logAudit('ROUND_CREATED', round.id, userId, { name: round.name, type: round.type });

    return round;
  }

  /**
   * Updates an existing round. Disallows dangerous edits while round is LIVE.
   */
  public async updateRound(id: string, input: UpdateRoundInput, userId?: string) {
    const round = await prisma.round.findUnique({ where: { id } });
    if (!round) {
      throw { statusCode: 404, message: 'Round not found' };
    }

    if (round.status === RoundStatus.LIVE) {
      if (input.duration !== undefined && input.duration !== round.duration) {
        throw { statusCode: 400, message: 'Cannot modify duration while round is LIVE' };
      }
      if (input.type !== undefined && input.type !== round.type) {
        throw { statusCode: 400, message: 'Cannot modify round type while round is LIVE' };
      }
    }

    const updatedRound = await prisma.round.update({
      where: { id },
      data: {
        name: input.name !== undefined ? input.name.trim() : undefined,
        type: input.type,
        description: input.description,
        duration: input.duration,
        maximumMarks: input.maximumMarks,
        order: input.order,
        isEnabled: input.isEnabled,
        status: input.status,
      },
    });

    await this.logAudit('ROUND_UPDATED', updatedRound.id, userId, input as Record<string, unknown>);

    return updatedRound;
  }

  /**
   * Deletes a round only if no student competition activity exists.
   * Checks indirect relations: StudentAnswer via Question, DebuggingSubmission via DebuggingProblem,
   * ProgrammingSubmission via ProgrammingProblem, plus direct progresses and scores.
   */
  public async deleteRound(id: string, userId?: string) {
    const round = await prisma.round.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            progresses: true,
            scores: true,
          },
        },
      },
    });

    if (!round) {
      throw { statusCode: 404, message: 'Round not found' };
    }

    // Check indirect activity: answers on questions belonging to this round
    const answerCount = await prisma.studentAnswer.count({
      where: { question: { roundId: id } },
    });

    // Check indirect activity: debugging submissions on problems belonging to this round
    const debugSubCount = await prisma.debuggingSubmission.count({
      where: { problem: { roundId: id } },
    });

    // Check indirect activity: programming submissions on problems belonging to this round
    const progSubCount = await prisma.programmingSubmission.count({
      where: { problem: { roundId: id } },
    });

    const activityCount =
      answerCount +
      debugSubCount +
      progSubCount +
      round._count.progresses +
      round._count.scores;

    if (activityCount > 0) {
      throw {
        statusCode: 400,
        message: 'Cannot delete round with existing student competition activity',
      };
    }

    await prisma.round.delete({ where: { id } });
    await this.logAudit('ROUND_DELETED', id, userId, { name: round.name });

    return { message: 'Round deleted successfully' };
  }

  /**
   * Reorders rounds in a single atomic database transaction.
   */
  public async reorderRounds(orderedRoundIds: string[], userId?: string) {
    if (!orderedRoundIds || !Array.isArray(orderedRoundIds) || orderedRoundIds.length === 0) {
      throw { statusCode: 400, message: 'Ordered round IDs array is required' };
    }

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < orderedRoundIds.length; i++) {
        const id = orderedRoundIds[i];
        await tx.round.update({
          where: { id },
          data: { order: i + 1 },
        });
      }
    });

    if (orderedRoundIds[0]) {
      await this.logAudit('ROUNDS_REORDERED', orderedRoundIds[0], userId, { orderedRoundIds });
    }

    return this.getRounds();
  }

  /**
   * Enables or disables a round. Cannot disable a LIVE or PAUSED round.
   */
  public async toggleRoundEnabled(id: string, isEnabled: boolean, userId?: string) {
    const round = await prisma.round.findUnique({ where: { id } });
    if (!round) {
      throw { statusCode: 404, message: 'Round not found' };
    }

    if (!isEnabled && (round.status === RoundStatus.LIVE || round.status === RoundStatus.PAUSED)) {
      throw { statusCode: 400, message: 'Cannot disable a LIVE or PAUSED round' };
    }

    const updatedRound = await prisma.round.update({
      where: { id },
      data: { isEnabled },
    });

    await this.logAudit(isEnabled ? 'ROUND_ENABLED' : 'ROUND_DISABLED', id, userId);

    return updatedRound;
  }

  /**
   * Starts a round (transitions status to LIVE using server clock).
   * Enforces sequential progression (Round N requires Round N-1 to be ENDED).
   */
  public async startRound(id: string, userId?: string) {
    const res = await prisma.$transaction(async (tx) => {
      const round = await tx.round.findUnique({ where: { id } });
      if (!round) {
        throw { statusCode: 404, message: 'Round not found' };
      }

      if (!round.isEnabled) {
        throw { statusCode: 400, message: 'Cannot start a disabled round' };
      }

      if (round.status === RoundStatus.LIVE) {
        throw { statusCode: 400, message: 'Round is already LIVE' };
      }

      // Sequential Progression Rule: Check previous ENABLED round in order
      if (round.order > 1) {
        const previousEnabledRound = await tx.round.findFirst({
          where: {
            eventId: round.eventId,
            order: { lt: round.order },
            isEnabled: true,
          },
          orderBy: { order: 'desc' },
        });

        if (previousEnabledRound && previousEnabledRound.status !== RoundStatus.ENDED) {
          throw {
            statusCode: 400,
            message: `Previous enabled round (${previousEnabledRound.name}) must be ENDED before starting this round`,
          };
        }
      }

      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + round.duration * 60 * 1000);

      const updatedRound = await tx.round.update({
        where: { id },
        data: {
          status: RoundStatus.LIVE,
          startTime,
          endTime,
          remainingSeconds: null,
        },
      });

      // Update parent event status to LIVE if draft/ready
      await tx.event.update({
        where: { id: round.eventId },
        data: { status: 'LIVE' },
      });

      await tx.auditLog.create({
        data: {
          action: 'ROUND_STARTED',
          entity: 'Round',
          entityId: round.id,
          userId,
          metadata: { name: round.name, startTime, endTime },
        },
      });

      return updatedRound;
    });

    broadcastRoundStarted(res);
    return res;
  }

  /**
   * Pauses a LIVE round, storing remaining time in seconds.
   */
  public async pauseRound(id: string, userId?: string) {
    const res = await prisma.$transaction(async (tx) => {
      const round = await tx.round.findUnique({ where: { id } });
      if (!round) {
        throw { statusCode: 404, message: 'Round not found' };
      }

      if (round.status !== RoundStatus.LIVE) {
        throw { statusCode: 400, message: 'Only LIVE rounds can be paused' };
      }

      const remainingMs = Math.max(0, (round.endTime?.getTime() || Date.now()) - Date.now());
      const remainingSeconds = Math.floor(remainingMs / 1000);

      const updatedRound = await tx.round.update({
        where: { id },
        data: {
          status: RoundStatus.PAUSED,
          remainingSeconds,
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'ROUND_PAUSED',
          entity: 'Round',
          entityId: round.id,
          userId,
          metadata: { name: round.name, remainingSeconds },
        },
      });

      return updatedRound;
    });

    broadcastRoundPaused(res.id);
    return res;
  }

  /**
   * Resumes a PAUSED round, calculating new deadline from remaining time.
   */
  public async resumeRound(id: string, userId?: string) {
    const res = await prisma.$transaction(async (tx) => {
      const round = await tx.round.findUnique({ where: { id } });
      if (!round) {
        throw { statusCode: 404, message: 'Round not found' };
      }

      if (round.status !== RoundStatus.PAUSED) {
        throw { statusCode: 400, message: 'Only PAUSED rounds can be resumed' };
      }

      const startTime = new Date();
      const durationSeconds = round.remainingSeconds !== null && round.remainingSeconds !== undefined
        ? round.remainingSeconds
        : round.duration * 60;
      const endTime = new Date(startTime.getTime() + durationSeconds * 1000);

      const updatedRound = await tx.round.update({
        where: { id },
        data: {
          status: RoundStatus.LIVE,
          startTime,
          endTime,
          remainingSeconds: null,
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'ROUND_RESUMED',
          entity: 'Round',
          entityId: round.id,
          userId,
          metadata: { name: round.name, newEndTime: endTime },
        },
      });

      return updatedRound;
    });

    broadcastRoundResumed(res);
    return res;
  }

  /**
   * Ends a LIVE or PAUSED round.
   */
  public async endRound(id: string, userId?: string) {
    const res = await prisma.$transaction(async (tx) => {
      const round = await tx.round.findUnique({ where: { id } });
      if (!round) {
        throw { statusCode: 404, message: 'Round not found' };
      }

      if (round.status === RoundStatus.ENDED) {
        throw { statusCode: 400, message: 'Round is already ENDED' };
      }

      const updatedRound = await tx.round.update({
        where: { id },
        data: {
          status: RoundStatus.ENDED,
          endTime: new Date(),
        },
      });

      // Check if all enabled rounds in the event are ENDED
      const unendedRoundsCount = await tx.round.count({
        where: {
          eventId: round.eventId,
          isEnabled: true,
          status: { not: RoundStatus.ENDED },
        },
      });

      if (unendedRoundsCount === 0) {
        await tx.event.update({
          where: { id: round.eventId },
          data: { status: 'ENDED' },
        });
      }

      await tx.auditLog.create({
        data: {
          action: 'ROUND_ENDED',
          entity: 'Round',
          entityId: round.id,
          userId,
          metadata: { name: round.name, eventCompleted: unendedRoundsCount === 0 },
        },
      });

      return updatedRound;
    });

      return updatedRound;
    });

    broadcastRoundEnded(res.id, res.name);
    return res;
  }

  /**
   * Safely restarts a round, resetting its status to READY, clearing authoritative timing state,
   * resetting active student progress for this round, and recording an audit log entry.
   */
  public async restartRound(id: string, reason?: string, userId?: string) {
    const res = await prisma.$transaction(async (tx) => {
      const round = await tx.round.findUnique({ where: { id } });
      if (!round) {
        throw { statusCode: 404, message: 'Round not found' };
      }

      if (round.status === RoundStatus.DRAFT) {
        throw { statusCode: 400, message: 'DRAFT rounds do not need to be restarted' };
      }

      const previousStatus = round.status;

      // 1. Reset Round state and timing
      const updatedRound = await tx.round.update({
        where: { id },
        data: {
          status: RoundStatus.READY,
          startTime: null,
          endTime: null,
          remainingSeconds: null,
        },
      });

      // 2. Reset active student round progress for this specific round
      await tx.roundProgress.deleteMany({
        where: { roundId: id },
      });

      // 3. Log audit event
      await tx.auditLog.create({
        data: {
          action: 'ROUND_RESTARTED',
          entity: 'Round',
          entityId: round.id,
          userId,
          metadata: {
            name: round.name,
            previousStatus,
            newStatus: RoundStatus.READY,
            reason: reason ? reason.trim() : undefined,
          },
        },
      });

      return updatedRound;
    });

    broadcastRoundRestarted(res.id);
    return res;
  }
}

export const adminRoundService = new AdminRoundService();

