import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { UserRole } from '@prisma/client';
import { prisma } from '../config/database';
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
      await prisma.auditLog.create({
        data: {
          action,
          entity,
          entityId,
          userId,
          metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
        },
      });
    } catch (err) {
      console.error('Failed to create audit log entry:', err);
    }
  }

  /**
   * Enforces single active session rule if singleSession setting is enabled.
   */
  private async handleSingleSessionPolicy(userId: string) {
    try {
      const eventSettings = await prisma.eventSettings.findFirst();
      const isSingleSessionEnabled = eventSettings ? eventSettings.singleSession : true;

      if (isSingleSessionEnabled) {
        // Revoke all existing active sessions for this user
        await prisma.session.updateMany({
          where: {
            userId,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: {
            revokedAt: new Date(),
          },
        });
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
    const student = await prisma.student.findUnique({
      where: { studentId },
      include: { user: true },
    });

    if (!student || !student.user) {
      await this.logAudit('STUDENT_LOGIN_FAILURE', 'Student', studentId, undefined, { reason: 'Student not found' });
      throw { statusCode: 401, message: 'Invalid credentials' };
    }

    const user = student.user;

    // Verify bcrypt password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      await this.logAudit('STUDENT_LOGIN_FAILURE', 'Student', student.id, user.id, { reason: 'Invalid password' });
      throw { statusCode: 401, message: 'Invalid credentials' };
    }

    // Verify active status
    if (!user.isActive || student.status !== 'ACTIVE') {
      throw { statusCode: 401, message: 'Account disabled' };
    }

    // Enforce single session policy
    await this.handleSingleSessionPolicy(user.id);

    // Create session in PostgreSQL
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_EXPIRATION_HOURS * 60 * 60 * 1000);

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        sessionToken,
        expiresAt,
      },
    });

    // Generate JWT
    const token = signAuthToken({
      userId: user.id,
      role: UserRole.STUDENT,
      sessionId: session.id,
    });

    await this.logAudit('STUDENT_LOGIN_SUCCESS', 'Student', student.id, user.id);

    return {
      user: {
        id: user.id,
        studentId: student.studentId,
        name: student.fullName,
        batch: student.batchNumber,
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
    const user = await prisma.user.findUnique({
      where: { username },
      include: { admin: true },
    });

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

    // Enforce single session policy
    await this.handleSingleSessionPolicy(user.id);

    // Create session in PostgreSQL
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_EXPIRATION_HOURS * 60 * 60 * 1000);

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        sessionToken,
        expiresAt,
      },
    });

    // Generate JWT
    const token = signAuthToken({
      userId: user.id,
      role: UserRole.ADMIN,
      sessionId: session.id,
    });

    await this.logAudit('ADMIN_LOGIN_SUCCESS', 'Admin', user.admin?.id || user.id, user.id);

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

    // Batch number validation: exactly 6 digits starting with 2840
    const batchRegex = /^2840\d{2}$/;
    if (!batchRegex.test(batchNumber)) {
      throw { statusCode: 400, message: 'Batch number must be exactly 6 digits starting with 2840 (e.g. 284001)' };
    }

    // Use transaction for atomic student registration
    return await prisma.$transaction(async (tx) => {
      // 1. Ensure Batch exists
      const batch = await tx.batch.upsert({
        where: { batchNumber },
        update: {},
        create: {
          batchNumber,
          name: `Batch ${batchNumber}`,
        },
      });

      // 2. Determine next available Student ID (e.g. SARA-061)
      const existingStudents = await tx.student.findMany({
        select: { studentId: true },
      });

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

      // 4. Create User & Student records
      const user = await tx.user.create({
        data: {
          username: nextStudentId,
          email: `${nextStudentId.toLowerCase()}@sara.edu`,
          passwordHash,
          role: UserRole.STUDENT,
          isActive: true,
        },
      });

      const student = await tx.student.create({
        data: {
          userId: user.id,
          studentId: nextStudentId,
          fullName,
          batchNumber: batch.batchNumber,
          batchId: batch.id,
          status: 'ACTIVE',
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'STUDENT_REGISTER_SUCCESS',
          entity: 'Student',
          entityId: student.id,
          userId: user.id,
          metadata: { studentId: nextStudentId, batchNumber },
        },
      });

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
      await prisma.session.update({
        where: { id: sessionId },
        data: { revokedAt: new Date() },
      });
      await this.logAudit('LOGOUT', 'Session', sessionId, userId);
    } catch (err) {
      console.error('Logout session revocation error:', err);
    }
  }

  /**
   * Retrieves sanitized profile information for current user.
   */
  public async getCurrentUser(userId: string): Promise<SafeUser> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        student: true,
        admin: true,
      },
    });

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

    return {
      id: user.id,
      studentId: user.student?.studentId,
      name: user.student?.fullName,
      batch: user.student?.batchNumber,
      role: UserRole.STUDENT,
    };
  }
}

export const authService = new AuthService();
