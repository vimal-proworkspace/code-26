import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { query, queryOne, transaction, txQuery, txQueryOne, txExecute } from '../config/database';
import { UserRole, DbUser, DbStudent, DbSession, DbAdmin } from '../config/types';
import { signAuthToken } from '../utils/jwt';
import { config } from '../config/env';

const SALT_ROUNDS = 10;
const SESSION_EXPIRATION_HOURS = 24;

export interface SafeUser {
  id: string;
  role: UserRole;
  username?: string;
  studentId?: string;
  name?: string;
  batch?: string;
}

export interface AuthResult {
  user: SafeUser;
  token: string;
  sessionId: string;
}

export class AuthService {
  /**
   * Helper to write audit log entries safely.
   */
  private async logAudit(action: string, entity: string, entityId?: string, userId?: string, metadata?: Record<string, unknown>) {
    try {
      await query(
        `INSERT INTO audit_logs (id, action, entity, "entityId", "userId", metadata, "createdAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())`,
        [action, entity, entityId || null, userId || null, metadata ? JSON.stringify(metadata) : null]
      );
    } catch (err) {
      console.error('Failed to create audit log entry:', err);
    }
  }

  /**
   * Enforces single active session rule if singleSession setting is enabled.
   */
  private async handleSingleSessionPolicy(userId: string) {
    try {
      const eventSettings = await queryOne<{ singleSession: boolean }>(
        `SELECT "singleSession" FROM event_settings LIMIT 1`
      );
      const isSingleSessionEnabled = eventSettings ? eventSettings.singleSession : true;

      if (isSingleSessionEnabled) {
        await query(
          `UPDATE sessions SET "revokedAt" = NOW()
           WHERE "userId" = $1 AND "revokedAt" IS NULL AND "expiresAt" > NOW()`,
          [userId]
        );
      }
    } catch (err) {
      console.error('Error handling single session policy:', err);
    }
  }

  /**
   * Authenticates a student using Student ID and password.
   */
  public async studentLogin(studentIdInput: string, passwordInput: string): Promise<AuthResult> {
    const studentId = (studentIdInput || '').trim().toUpperCase();
    const password = passwordInput || '';

    if (!studentId || !password) {
      throw { statusCode: 401, message: 'Invalid credentials' };
    }

    // Find student and associated user
    const row = await queryOne<DbStudent & { user_id: string; user_username: string; user_passwordHash: string; user_role: UserRole; user_isActive: boolean }>(
      `SELECT s.*, u.id as user_id, u.username as user_username, u."passwordHash" as "user_passwordHash",
              u.role as user_role, u."isActive" as "user_isActive"
       FROM students s
       JOIN users u ON u.id = s."userId"
       WHERE s."studentId" = $1`,
      [studentId]
    );

    if (!row) {
      await this.logAudit('STUDENT_LOGIN_FAILURE', 'Student', studentId, undefined, { reason: 'Student not found' });
      throw { statusCode: 401, message: 'Invalid credentials' };
    }

    // Verify bcrypt password
    const isPasswordValid = await bcrypt.compare(password, row.user_passwordHash);
    if (!isPasswordValid) {
      await this.logAudit('STUDENT_LOGIN_FAILURE', 'Student', row.id, row.userId, { reason: 'Invalid password' });
      throw { statusCode: 401, message: 'Invalid credentials' };
    }

    // Verify active status
    if (!row.user_isActive || row.status !== 'ACTIVE') {
      throw { statusCode: 401, message: 'Account disabled' };
    }

    // Enforce single session policy
    await this.handleSingleSessionPolicy(row.userId);

    // Create session in PostgreSQL
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_EXPIRATION_HOURS * 60 * 60 * 1000);

    const session = await queryOne<DbSession>(
      `INSERT INTO sessions (id, "userId", "sessionToken", "createdAt", "expiresAt", "lastSeenAt")
       VALUES (gen_random_uuid(), $1, $2, NOW(), $3, NOW())
       RETURNING *`,
      [row.userId, sessionToken, expiresAt]
    );

    if (!session) {
      throw { statusCode: 500, message: 'Failed to create session' };
    }

    // Generate JWT
    const token = signAuthToken({
      userId: row.userId,
      role: UserRole.STUDENT,
      sessionId: session.id,
    });

    await this.logAudit('STUDENT_LOGIN_SUCCESS', 'Student', row.id, row.userId);

    return {
      user: {
        id: row.userId,
        studentId: row.studentId,
        name: row.fullName,
        batch: row.batchNumber,
        role: UserRole.STUDENT,
      },
      token,
      sessionId: session.id,
    };
  }

  /**
   * Authenticates an admin user using username and password.
   */
  public async adminLogin(usernameInput: string, passwordInput: string): Promise<AuthResult> {
    const username = (usernameInput || '').trim();
    const password = passwordInput || '';

    if (!username || !password) {
      throw { statusCode: 401, message: 'Invalid credentials' };
    }

    // Find admin user
    const user = await queryOne<DbUser>(
      `SELECT * FROM users WHERE username = $1`,
      [username]
    );

    if (!user || user.role !== UserRole.ADMIN) {
      await this.logAudit('ADMIN_LOGIN_FAILURE', 'User', username, undefined, { reason: 'Admin user not found' });
      throw { statusCode: 401, message: 'Invalid credentials' };
    }

    // Verify bcrypt password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      await this.logAudit('ADMIN_LOGIN_FAILURE', 'User', user.id, user.id, { reason: 'Invalid password' });
      throw { statusCode: 401, message: 'Invalid credentials' };
    }

    if (!user.isActive) {
      throw { statusCode: 401, message: 'Account disabled' };
    }

    // Check for admin record
    const admin = await queryOne<DbAdmin>(
      `SELECT * FROM admins WHERE "userId" = $1`,
      [user.id]
    );

    // Enforce single session policy
    await this.handleSingleSessionPolicy(user.id);

    // Create session in PostgreSQL
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_EXPIRATION_HOURS * 60 * 60 * 1000);

    const session = await queryOne<DbSession>(
      `INSERT INTO sessions (id, "userId", "sessionToken", "createdAt", "expiresAt", "lastSeenAt")
       VALUES (gen_random_uuid(), $1, $2, NOW(), $3, NOW())
       RETURNING *`,
      [user.id, sessionToken, expiresAt]
    );

    if (!session) {
      throw { statusCode: 500, message: 'Failed to create session' };
    }

    // Generate JWT
    const token = signAuthToken({
      userId: user.id,
      role: UserRole.ADMIN,
      sessionId: session.id,
    });

    await this.logAudit('ADMIN_LOGIN_SUCCESS', 'Admin', admin?.id || user.id, user.id);

    return {
      user: {
        id: user.id,
        username: user.username,
        role: UserRole.ADMIN,
      },
      token,
      sessionId: session.id,
    };
  }

  /**
   * Registers a new student account, generating sequential Student IDs (SARA-061+).
   */
  public async registerStudent(fullNameInput: string, batchNumberInput: string): Promise<{ studentId: string; fullName: string; batchNumber: string }> {
    const fullName = (fullNameInput || '').trim();
    const batchNumber = (batchNumberInput || '').trim();

    if (!fullName) {
      throw { statusCode: 400, message: 'Full name is required' };
    }

    // Batch number validation: exactly 6 numeric digits
    const batchRegex = /^\d{6}$/;
    if (!batchRegex.test(batchNumber)) {
      throw { statusCode: 400, message: 'Batch number must be exactly 6 numeric digits (e.g. 284001)' };
    }

    // Use transaction for atomic student registration
    return await transaction(async (client) => {
      // 1. Ensure Batch exists (upsert)
      let batch = await txQueryOne<{ id: string; batchNumber: string }>(client,
        `SELECT id, "batchNumber" FROM batches WHERE "batchNumber" = $1`,
        [batchNumber]
      );

      if (!batch) {
        batch = await txQueryOne<{ id: string; batchNumber: string }>(client,
          `INSERT INTO batches (id, "batchNumber", name, "createdAt", "updatedAt")
           VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())
           RETURNING id, "batchNumber"`,
          [batchNumber, `Batch ${batchNumber}`]
        );
      }

      if (!batch) {
        throw { statusCode: 500, message: 'Failed to create batch' };
      }

      // 2. Determine next available Student ID (e.g. SARA-061)
      const existingStudents = await txQuery<{ studentId: string }>(client,
        `SELECT "studentId" FROM students`
      );

      let maxIndex = 0;
      for (const s of existingStudents) {
        const match = s.studentId.match(/^SARA-(\d+)$/i);
        if (match) {
          const idx = parseInt(match[1], 10);
          if (!isNaN(idx) && idx > maxIndex) {
            maxIndex = idx;
          }
        }
      }

      const nextIndex = maxIndex + 1;
      const nextStudentId = `SARA-${String(nextIndex).padStart(3, '0')}`;

      // 3. Hash default student password
      const defaultPassword = config.defaultStudentPassword || 'welcome@sara';
      const passwordHash = await bcrypt.hash(defaultPassword, SALT_ROUNDS);

      // 4. Create User record
      const user = await txQueryOne<{ id: string }>(client,
        `INSERT INTO users (id, username, email, "passwordHash", role, "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
         RETURNING id`,
        [nextStudentId, `${nextStudentId.toLowerCase()}@sara.edu`, passwordHash, UserRole.STUDENT]
      );

      if (!user) {
        throw { statusCode: 500, message: 'Failed to create user' };
      }

      // 5. Create Student record
      const student = await txQueryOne<{ id: string; studentId: string; fullName: string; batchNumber: string }>(client,
        `INSERT INTO students (id, "userId", "studentId", "fullName", "batchNumber", "batchId", status, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'ACTIVE', NOW(), NOW())
         RETURNING id, "studentId", "fullName", "batchNumber"`,
        [user.id, nextStudentId, fullName, batchNumber, batch.id]
      );

      if (!student) {
        throw { statusCode: 500, message: 'Failed to create student' };
      }

      // 6. Audit log
      await txQueryOne(client,
        `INSERT INTO audit_logs (id, action, entity, "entityId", "userId", metadata, "createdAt")
         VALUES (gen_random_uuid(), 'STUDENT_REGISTER_SUCCESS', 'Student', $1, $2, $3, NOW())`,
        [student.id, user.id, JSON.stringify({ studentId: nextStudentId, batchNumber })]
      );

      return {
        studentId: student.studentId,
        fullName: student.fullName,
        batchNumber: student.batchNumber,
      };
    });
  }

  /**
   * Revokes user session in database.
   */
  public async logout(sessionId: string, userId?: string): Promise<void> {
    try {
      await query(
        `UPDATE sessions SET "revokedAt" = NOW() WHERE id = $1`,
        [sessionId]
      );
      await this.logAudit('LOGOUT', 'Session', sessionId, userId);
    } catch (err) {
      console.error('Logout session revocation error:', err);
    }
  }

  /**
   * Retrieves sanitized profile information for current user.
   */
  public async getCurrentUser(userId: string): Promise<SafeUser> {
    const user = await queryOne<DbUser>(
      `SELECT * FROM users WHERE id = $1`,
      [userId]
    );

    if (!user) {
      throw { statusCode: 404, message: 'User not found' };
    }

    if (user.role === UserRole.ADMIN) {
      return {
        id: user.id,
        username: user.username,
        role: UserRole.ADMIN,
      };
    }

    const student = await queryOne<DbStudent>(
      `SELECT * FROM students WHERE "userId" = $1`,
      [userId]
    );

    return {
      id: user.id,
      studentId: student?.studentId,
      name: student?.fullName,
      batch: student?.batchNumber,
      role: UserRole.STUDENT,
    };
  }
}

export const authService = new AuthService();
