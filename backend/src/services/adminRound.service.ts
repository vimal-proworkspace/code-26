import { RoundType, RoundStatus, DbRound, DbEvent } from '../config/types';
import { query, queryOne, transaction, txQuery, txQueryOne, txExecute } from '../config/database';
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
      await query(
        `INSERT INTO audit_logs (id, action, entity, "entityId", "userId", metadata, "createdAt")
         VALUES (gen_random_uuid(), $1, 'Round', $2, $3, $4, NOW())`,
        [action, roundId, userId || null, metadata ? JSON.stringify(metadata) : null]
      );
    } catch (err) {
      console.error('Failed to create admin audit log entry:', err);
    }
  }

  /**
   * Helper to retrieve primary event ID if not explicitly specified.
   */
  private async getPrimaryEventId(): Promise<string> {
    const event = await queryOne<DbEvent>(
      `SELECT * FROM events ORDER BY "createdAt" ASC LIMIT 1`
    );
    if (!event) {
      const newEvent = await queryOne<DbEvent>(
        `INSERT INTO events (id, name, status, "createdAt", "updatedAt")
         VALUES ('coding-challenge-2026-event-id', 'Coding Challenge 2026', 'DRAFT', NOW(), NOW())
         RETURNING *`
      );
      return newEvent!.id;
    }
    return event.id;
  }

  /**
   * Retrieves all rounds ordered by 'order' index ascending.
   */
  public async getRounds() {
    const eventId = await this.getPrimaryEventId();
    const event = await queryOne<DbEvent>(
      `SELECT * FROM events WHERE id = $1`,
      [eventId]
    );

    const settings = await queryOne(
      `SELECT * FROM event_settings WHERE "eventId" = $1`,
      [eventId]
    );

    const visibility = await queryOne(
      `SELECT * FROM visibility_settings WHERE "eventId" = $1`,
      [eventId]
    );

    const rounds = await query<DbRound>(
      `SELECT * FROM rounds WHERE "eventId" = $1 ORDER BY "order" ASC`,
      [eventId]
    );

    // Compute counts for each round
    const roundsWithCounts = await Promise.all(
      rounds.map(async (r) => {
        const questions = await queryOne<{ count: string }>(`SELECT COUNT(*) FROM questions WHERE "roundId" = $1`, [r.id]);
        const debuggingProblems = await queryOne<{ count: string }>(`SELECT COUNT(*) FROM debugging_problems WHERE "roundId" = $1`, [r.id]);
        const programmingProblems = await queryOne<{ count: string }>(`SELECT COUNT(*) FROM programming_problems WHERE "roundId" = $1`, [r.id]);
        const progresses = await queryOne<{ count: string }>(`SELECT COUNT(*) FROM round_progress WHERE "roundId" = $1`, [r.id]);
        const scores = await queryOne<{ count: string }>(`SELECT COUNT(*) FROM round_scores WHERE "roundId" = $1`, [r.id]);

        return {
          ...r,
          _count: {
            questions: parseInt(questions?.count || '0', 10),
            debuggingProblems: parseInt(debuggingProblems?.count || '0', 10),
            programmingProblems: parseInt(programmingProblems?.count || '0', 10),
            progresses: parseInt(progresses?.count || '0', 10),
            scores: parseInt(scores?.count || '0', 10),
          },
        };
      })
    );

    return {
      event: event ? { ...event, settings, visibility } : null,
      rounds: roundsWithCounts,
    };
  }

  /**
   * Retrieves a single round by ID.
   */
  public async getRoundById(id: string) {
    const round = await queryOne<DbRound>(
      `SELECT * FROM rounds WHERE id = $1`,
      [id]
    );

    if (!round) {
      throw { statusCode: 404, message: 'Round not found' };
    }

    const questions = await query(`SELECT * FROM questions WHERE "roundId" = $1 ORDER BY "order" ASC`, [id]);
    const debuggingProblems = await query(`SELECT * FROM debugging_problems WHERE "roundId" = $1`, [id]);
    const programmingProblems = await query(`SELECT * FROM programming_problems WHERE "roundId" = $1`, [id]);
    const progressesCount = await queryOne<{ count: string }>(`SELECT COUNT(*) FROM round_progress WHERE "roundId" = $1`, [id]);
    const scoresCount = await queryOne<{ count: string }>(`SELECT COUNT(*) FROM round_scores WHERE "roundId" = $1`, [id]);

    return {
      ...round,
      questions,
      debuggingProblems,
      programmingProblems,
      _count: {
        progresses: parseInt(progressesCount?.count || '0', 10),
        scores: parseInt(scoresCount?.count || '0', 10),
      },
    };
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

    let order = input.order;
    if (order === undefined || order === null) {
      const highestRound = await queryOne<{ max_order: number }>(
        `SELECT MAX("order") as max_order FROM rounds WHERE "eventId" = $1`,
        [eventId]
      );
      order = (highestRound?.max_order || 0) + 1;
    }

    const isEnabled = input.isEnabled !== undefined ? input.isEnabled : true;

    const round = await queryOne<DbRound>(
      `INSERT INTO rounds (id, "eventId", name, type, description, duration, "maximumMarks", "order", "isEnabled", status, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, 'DRAFT', NOW(), NOW())
       RETURNING *`,
      [eventId, name, input.type, input.description || null, input.duration, input.maximumMarks, order, isEnabled]
    );

    if (!round) {
      throw { statusCode: 500, message: 'Failed to create round' };
    }

    await this.logAudit('ROUND_CREATED', round.id, userId, { name: round.name, type: round.type });

    return round;
  }

  /**
   * Updates an existing round. Disallows dangerous edits while round is LIVE.
   */
  public async updateRound(id: string, input: UpdateRoundInput, userId?: string) {
    const round = await queryOne<DbRound>(`SELECT * FROM rounds WHERE id = $1`, [id]);
    if (!round) {
      throw { statusCode: 404, message: 'Round not found' };
    }

    if (round.status === 'LIVE') {
      if (input.duration !== undefined && input.duration !== round.duration) {
        throw { statusCode: 400, message: 'Cannot modify duration while round is LIVE' };
      }
      if (input.type !== undefined && input.type !== round.type) {
        throw { statusCode: 400, message: 'Cannot modify round type while round is LIVE' };
      }
    }

    const name = input.name !== undefined ? input.name.trim() : round.name;
    const type = input.type !== undefined ? input.type : round.type;
    const description = input.description !== undefined ? input.description : round.description;
    const duration = input.duration !== undefined ? input.duration : round.duration;
    const maximumMarks = input.maximumMarks !== undefined ? input.maximumMarks : round.maximumMarks;
    const order = input.order !== undefined ? input.order : round.order;
    const isEnabled = input.isEnabled !== undefined ? input.isEnabled : round.isEnabled;
    const status = input.status !== undefined ? input.status : round.status;

    const updatedRound = await queryOne<DbRound>(
      `UPDATE rounds
       SET name = $1, type = $2, description = $3, duration = $4, "maximumMarks" = $5,
           "order" = $6, "isEnabled" = $7, status = $8, "updatedAt" = NOW()
       WHERE id = $9
       RETURNING *`,
      [name, type, description, duration, maximumMarks, order, isEnabled, status, id]
    );

    await this.logAudit('ROUND_UPDATED', id, userId, input as Record<string, unknown>);

    return updatedRound;
  }

  /**
   * Deletes a round only if no student competition activity exists.
   */
  public async deleteRound(id: string, userId?: string) {
    const round = await queryOne<DbRound>(`SELECT * FROM rounds WHERE id = $1`, [id]);
    if (!round) {
      throw { statusCode: 404, message: 'Round not found' };
    }

    const answerCount = await queryOne<{ count: string }>(
      `SELECT COUNT(*) FROM student_answers sa JOIN questions q ON q.id = sa."questionId" WHERE q."roundId" = $1`,
      [id]
    );
    const debugSubCount = await queryOne<{ count: string }>(
      `SELECT COUNT(*) FROM debugging_submissions ds JOIN debugging_problems dp ON dp.id = ds."debuggingProblemId" WHERE dp."roundId" = $1`,
      [id]
    );
    const progSubCount = await queryOne<{ count: string }>(
      `SELECT COUNT(*) FROM programming_submissions ps JOIN programming_problems pp ON pp.id = ps."programmingProblemId" WHERE pp."roundId" = $1`,
      [id]
    );
    const progressCount = await queryOne<{ count: string }>(
      `SELECT COUNT(*) FROM round_progress WHERE "roundId" = $1`,
      [id]
    );
    const scoreCount = await queryOne<{ count: string }>(
      `SELECT COUNT(*) FROM round_scores WHERE "roundId" = $1`,
      [id]
    );

    const totalActivity =
      parseInt(answerCount?.count || '0', 10) +
      parseInt(debugSubCount?.count || '0', 10) +
      parseInt(progSubCount?.count || '0', 10) +
      parseInt(progressCount?.count || '0', 10) +
      parseInt(scoreCount?.count || '0', 10);

    if (totalActivity > 0) {
      throw {
        statusCode: 400,
        message: 'Cannot delete round with existing student competition activity',
      };
    }

    await query(`DELETE FROM rounds WHERE id = $1`, [id]);
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

    await transaction(async (client) => {
      for (let i = 0; i < orderedRoundIds.length; i++) {
        await txExecute(client, `UPDATE rounds SET "order" = $1, "updatedAt" = NOW() WHERE id = $2`, [i + 1, orderedRoundIds[i]]);
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
    const round = await queryOne<DbRound>(`SELECT * FROM rounds WHERE id = $1`, [id]);
    if (!round) {
      throw { statusCode: 404, message: 'Round not found' };
    }

    if (!isEnabled && (round.status === 'LIVE' || round.status === 'PAUSED')) {
      throw { statusCode: 400, message: 'Cannot disable a LIVE or PAUSED round' };
    }

    const updatedRound = await queryOne<DbRound>(
      `UPDATE rounds SET "isEnabled" = $1, "updatedAt" = NOW() WHERE id = $2 RETURNING *`,
      [isEnabled, id]
    );

    await this.logAudit(isEnabled ? 'ROUND_ENABLED' : 'ROUND_DISABLED', id, userId);

    return updatedRound;
  }

  /**
   * Starts a round (transitions status to LIVE using server clock).
   */
  public async startRound(id: string, userId?: string) {
    const res = await transaction(async (client) => {
      const round = await txQueryOne<DbRound>(client, `SELECT * FROM rounds WHERE id = $1`, [id]);
      if (!round) {
        throw { statusCode: 404, message: 'Round not found' };
      }

      if (!round.isEnabled) {
        throw { statusCode: 400, message: 'Cannot start a disabled round' };
      }

      if (round.status === 'LIVE') {
        throw { statusCode: 400, message: 'Round is already LIVE' };
      }

      if (round.order > 1) {
        const previousEnabledRound = await txQueryOne<DbRound>(client,
          `SELECT * FROM rounds WHERE "eventId" = $1 AND "order" < $2 AND "isEnabled" = true ORDER BY "order" DESC LIMIT 1`,
          [round.eventId, round.order]
        );

        if (previousEnabledRound && previousEnabledRound.status !== 'ENDED') {
          throw {
            statusCode: 400,
            message: `Previous enabled round (${previousEnabledRound.name}) must be ENDED before starting this round`,
          };
        }
      }

      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + round.duration * 60 * 1000);

      const updatedRound = await txQueryOne<DbRound>(client,
        `UPDATE rounds
         SET status = 'LIVE', "startTime" = $1, "endTime" = $2, "remainingSeconds" = NULL, "updatedAt" = NOW()
         WHERE id = $3
         RETURNING *`,
        [startTime, endTime, id]
      );

      await txExecute(client,
        `UPDATE events SET status = 'LIVE', "updatedAt" = NOW() WHERE id = $1`,
        [round.eventId]
      );

      await txExecute(client,
        `INSERT INTO audit_logs (id, action, entity, "entityId", "userId", metadata, "createdAt")
         VALUES (gen_random_uuid(), 'ROUND_STARTED', 'Round', $1, $2, $3, NOW())`,
        [round.id, userId || null, JSON.stringify({ name: round.name, startTime, endTime })]
      );

      return updatedRound!;
    });

    broadcastRoundStarted(res);
    return res;
  }

  /**
   * Pauses a LIVE round, storing remaining time in seconds.
   */
  public async pauseRound(id: string, userId?: string) {
    const res = await transaction(async (client) => {
      const round = await txQueryOne<DbRound>(client, `SELECT * FROM rounds WHERE id = $1`, [id]);
      if (!round) {
        throw { statusCode: 404, message: 'Round not found' };
      }

      if (round.status !== 'LIVE') {
        throw { statusCode: 400, message: 'Only LIVE rounds can be paused' };
      }

      const remainingMs = Math.max(0, (round.endTime ? new Date(round.endTime).getTime() : Date.now()) - Date.now());
      const remainingSeconds = Math.floor(remainingMs / 1000);

      const updatedRound = await txQueryOne<DbRound>(client,
        `UPDATE rounds
         SET status = 'PAUSED', "remainingSeconds" = $1, "updatedAt" = NOW()
         WHERE id = $2
         RETURNING *`,
        [remainingSeconds, id]
      );

      await txExecute(client,
        `INSERT INTO audit_logs (id, action, entity, "entityId", "userId", metadata, "createdAt")
         VALUES (gen_random_uuid(), 'ROUND_PAUSED', 'Round', $1, $2, $3, NOW())`,
        [round.id, userId || null, JSON.stringify({ name: round.name, remainingSeconds })]
      );

      return updatedRound!;
    });

    broadcastRoundPaused(res.id);
    return res;
  }

  /**
   * Resumes a PAUSED round, calculating new deadline from remaining time.
   */
  public async resumeRound(id: string, userId?: string) {
    const res = await transaction(async (client) => {
      const round = await txQueryOne<DbRound>(client, `SELECT * FROM rounds WHERE id = $1`, [id]);
      if (!round) {
        throw { statusCode: 404, message: 'Round not found' };
      }

      if (round.status !== 'PAUSED') {
        throw { statusCode: 400, message: 'Only PAUSED rounds can be resumed' };
      }

      const startTime = new Date();
      const durationSeconds = round.remainingSeconds !== null && round.remainingSeconds !== undefined
        ? round.remainingSeconds
        : round.duration * 60;
      const endTime = new Date(startTime.getTime() + durationSeconds * 1000);

      const updatedRound = await txQueryOne<DbRound>(client,
        `UPDATE rounds
         SET status = 'LIVE', "startTime" = $1, "endTime" = $2, "remainingSeconds" = NULL, "updatedAt" = NOW()
         WHERE id = $3
         RETURNING *`,
        [startTime, endTime, id]
      );

      await txExecute(client,
        `INSERT INTO audit_logs (id, action, entity, "entityId", "userId", metadata, "createdAt")
         VALUES (gen_random_uuid(), 'ROUND_RESUMED', 'Round', $1, $2, $3, NOW())`,
        [round.id, userId || null, JSON.stringify({ name: round.name, newEndTime: endTime })]
      );

      return updatedRound!;
    });

    broadcastRoundResumed(res);
    return res;
  }

  /**
   * Ends a LIVE or PAUSED round.
   */
  public async endRound(id: string, userId?: string) {
    const res = await transaction(async (client) => {
      const round = await txQueryOne<DbRound>(client, `SELECT * FROM rounds WHERE id = $1`, [id]);
      if (!round) {
        throw { statusCode: 404, message: 'Round not found' };
      }

      if (round.status === 'ENDED') {
        throw { statusCode: 400, message: 'Round is already ENDED' };
      }

      const updatedRound = await txQueryOne<DbRound>(client,
        `UPDATE rounds SET status = 'ENDED', "endTime" = NOW(), "updatedAt" = NOW() WHERE id = $1 RETURNING *`,
        [id]
      );

      const unended = await txQueryOne<{ count: string }>(client,
        `SELECT COUNT(*) FROM rounds WHERE "eventId" = $1 AND "isEnabled" = true AND status != 'ENDED'`,
        [round.eventId]
      );

      const unendedCount = parseInt(unended?.count || '0', 10);
      if (unendedCount === 0) {
        await txExecute(client, `UPDATE events SET status = 'ENDED', "updatedAt" = NOW() WHERE id = $1`, [round.eventId]);
      }

      await txExecute(client,
        `INSERT INTO audit_logs (id, action, entity, "entityId", "userId", metadata, "createdAt")
         VALUES (gen_random_uuid(), 'ROUND_ENDED', 'Round', $1, $2, $3, NOW())`,
        [round.id, userId || null, JSON.stringify({ name: round.name, eventCompleted: unendedCount === 0 })]
      );

      return updatedRound!;
    });

    broadcastRoundEnded(res.id, res.name);
    return res;
  }

  /**
   * Safely restarts a round, resetting its status to READY, clearing timing state,
   * resetting active student progress for this round, and recording an audit log entry.
   */
  public async restartRound(id: string, reason?: string, userId?: string) {
    const res = await transaction(async (client) => {
      const round = await txQueryOne<DbRound>(client, `SELECT * FROM rounds WHERE id = $1`, [id]);
      if (!round) {
        throw { statusCode: 404, message: 'Round not found' };
      }

      if (round.status === 'DRAFT') {
        throw { statusCode: 400, message: 'DRAFT rounds do not need to be restarted' };
      }

      const previousStatus = round.status;

      const updatedRound = await txQueryOne<DbRound>(client,
        `UPDATE rounds
         SET status = 'READY', "startTime" = NULL, "endTime" = NULL, "remainingSeconds" = NULL, "updatedAt" = NOW()
         WHERE id = $1
         RETURNING *`,
        [id]
      );

      await txExecute(client, `DELETE FROM round_progress WHERE "roundId" = $1`, [id]);

      await txExecute(client,
        `INSERT INTO audit_logs (id, action, entity, "entityId", "userId", metadata, "createdAt")
         VALUES (gen_random_uuid(), 'ROUND_RESTARTED', 'Round', $1, $2, $3, NOW())`,
        [round.id, userId || null, JSON.stringify({ name: round.name, previousStatus, newStatus: 'READY', reason: reason ? reason.trim() : undefined })]
      );

      return updatedRound!;
    });

    broadcastRoundRestarted(res.id);
    return res;
  }
}

export const adminRoundService = new AdminRoundService();
