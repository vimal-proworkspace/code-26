/**
 * Verification Test Script for Step 6: Authentication & Session Management
 *
 * Usage: npx ts-node src/tests/verifyAuth.ts
 */

import { authService } from '../services/auth.service';
import { verifyAuthToken } from '../utils/jwt';
import { prisma } from '../config/database';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ name, passed: true, details: 'OK' });
    console.log(`  ✅ ${name}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    results.push({ name, passed: false, details: msg });
    console.log(`  ❌ ${name}: ${msg}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function main() {
  console.log('\n========================================');
  console.log('Authentication & Session Verification');
  console.log('========================================\n');

  // 1. Student Login
  console.log('--- Student Authentication Tests ---');

  await runTest('Student Login (SARA-001 / welcome@sara)', async () => {
    const res = await authService.studentLogin('SARA-001', 'welcome@sara');
    assert(res.user.role === 'STUDENT', `Expected STUDENT role, got ${res.user.role}`);
    assert(res.user.studentId === 'SARA-001', `Expected SARA-001, got ${res.user.studentId}`);
    assert(!!res.token, 'Token should be issued');
    assert(!!res.sessionId, 'Session ID should be returned');
    assert((res.user as any).passwordHash === undefined, 'passwordHash must NOT be returned');

    const decoded = verifyAuthToken(res.token);
    assert(decoded.role === 'STUDENT', 'Decoded token role should be STUDENT');
  });

  await runTest('Student Login Failure: Wrong Password', async () => {
    try {
      await authService.studentLogin('SARA-001', 'wrongpass');
      throw new Error('Should have thrown invalid credentials');
    } catch (err: any) {
      assert(err.statusCode === 401, `Expected status 401, got ${err.statusCode}`);
      assert(err.message === 'Invalid credentials', `Expected "Invalid credentials", got ${err.message}`);
    }
  });

  await runTest('Student Login Failure: Non-existent Student', async () => {
    try {
      await authService.studentLogin('SARA-999', 'welcome@sara');
      throw new Error('Should have thrown invalid credentials');
    } catch (err: any) {
      assert(err.statusCode === 401, `Expected status 401, got ${err.statusCode}`);
      assert(err.message === 'Invalid credentials', `Expected "Invalid credentials", got ${err.message}`);
    }
  });

  // 2. Admin Login
  console.log('\n--- Admin Authentication Tests ---');

  await runTest('Admin Login (admin@it.com / admin@it)', async () => {
    const res = await authService.adminLogin('admin@it.com', 'admin@it');
    assert(res.user.role === 'ADMIN', `Expected ADMIN role, got ${res.user.role}`);
    assert(res.user.username === 'admin@it.com', `Expected admin@it.com, got ${res.user.username}`);
    assert(!!res.token, 'Token should be issued');
    assert((res.user as any).passwordHash === undefined, 'passwordHash must NOT be returned');
  });

  await runTest('Admin Login Failure: Student credentials rejected', async () => {
    try {
      await authService.adminLogin('SARA-001', 'welcome@sara');
      throw new Error('Should have thrown invalid credentials');
    } catch (err: any) {
      assert(err.statusCode === 401, `Expected status 401, got ${err.statusCode}`);
      assert(err.message === 'Invalid credentials', `Expected "Invalid credentials", got ${err.message}`);
    }
  });

  // 3. Student Registration
  console.log('\n--- Student Registration Tests ---');

  let newStudentId = '';
  await runTest('Student Registration: Valid Batch 284001', async () => {
    const res = await authService.registerStudent('Verification Test Student', '284001');
    assert(!!res.studentId, 'Student ID should be assigned');
    assert(res.studentId.startsWith('SARA-'), `Student ID should start with SARA-, got ${res.studentId}`);
    assert(res.batchNumber === '284001', 'Batch number should match');
    newStudentId = res.studentId;
  });

  await runTest('Registered Student Login', async () => {
    assert(!!newStudentId, 'Registered student ID must exist');
    const res = await authService.studentLogin(newStudentId, 'welcome@sara');
    assert(res.user.studentId === newStudentId, 'Should log in successfully with new ID');
  });

  await runTest('Student Registration: Batch validation failure (184001)', async () => {
    try {
      await authService.registerStudent('Bad Batch Student', '184001');
      throw new Error('Should have rejected invalid batch');
    } catch (err: any) {
      assert(err.statusCode === 400, `Expected status 400, got ${err.statusCode}`);
    }
  });

  await runTest('Student Registration: Batch validation failure (2840)', async () => {
    try {
      await authService.registerStudent('Short Batch Student', '2840');
      throw new Error('Should have rejected invalid batch');
    } catch (err: any) {
      assert(err.statusCode === 400, `Expected status 400, got ${err.statusCode}`);
    }
  });

  // 4. Single Session Policy
  console.log('\n--- Single Session Policy Tests ---');

  await runTest('Single Session Enforcement', async () => {
    const login1 = await authService.studentLogin('SARA-002', 'welcome@sara');
    const sess1Before = await prisma.session.findUnique({ where: { id: login1.sessionId } });
    assert(sess1Before?.revokedAt === null, 'Session 1 should be active initially');

    // Second login from another device/browser
    const login2 = await authService.studentLogin('SARA-002', 'welcome@sara');
    const sess1After = await prisma.session.findUnique({ where: { id: login1.sessionId } });
    const sess2After = await prisma.session.findUnique({ where: { id: login2.sessionId } });

    assert(sess1After?.revokedAt !== null, 'Session 1 should be revoked after second login');
    assert(sess2After?.revokedAt === null, 'Session 2 should be active');
  });

  // 5. Logout & Session Revocation
  console.log('\n--- Logout & Session Revocation Tests ---');

  await runTest('Logout revokes active session', async () => {
    const login = await authService.studentLogin('SARA-003', 'welcome@sara');
    await authService.logout(login.sessionId, login.user.id);

    const session = await prisma.session.findUnique({ where: { id: login.sessionId } });
    assert(session?.revokedAt !== null, 'Session should be revoked after logout');
  });

  // ============ SUMMARY ============
  console.log('\n========================================');
  console.log('VERIFICATION SUMMARY');
  console.log('========================================');

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log(`\nTotal: ${total}  Passed: ${passed}  Failed: ${failed}`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`  ❌ ${r.name}: ${r.details}`);
    }
  }

  console.log(`\nOverall: ${failed === 0 ? '✅ ALL PASSED' : '❌ SOME FAILED'}`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main();
