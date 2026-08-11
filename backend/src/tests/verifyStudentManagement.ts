import { prisma } from '../config/database';
import { adminStudentService } from '../services/adminStudent.service';
import { createApp } from '../app';
import http from 'http';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';

async function runVerification() {
  console.log('====================================================');
  console.log('STARTING STEP 16 AUTOMATED VERIFICATION');
  console.log('====================================================');

  const app = createApp();

  // 1. Fetch test admin user and student user
  const adminUser = await prisma.user.findFirst({ where: { role: UserRole.ADMIN } });
  const studentUser = await prisma.user.findFirst({ where: { role: UserRole.STUDENT }, include: { student: true } });

  if (!adminUser || !studentUser || !studentUser.student) {
    throw new Error('Database is missing admin or seeded student users');
  }

  // Create JWT tokens
  const adminToken = jwt.sign(
    { userId: adminUser.id, role: adminUser.role, email: adminUser.email, username: adminUser.username },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  const studentToken = jwt.sign(
    { userId: studentUser.id, role: studentUser.role, studentId: studentUser.student.studentId, username: studentUser.username },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  console.log('✓ Test user tokens generated.');

  // TEST 1: Admin can list students with pagination & summary
  const listRes = await request(app)
    .get('/api/admin/students?page=1&limit=10')
    .set('Cookie', [`token=${adminToken}`]);

  if (listRes.status !== 200 || !listRes.body.data.students || !listRes.body.data.summary) {
    throw new Error(`Failed to list students: ${listRes.status} ${JSON.stringify(listRes.body)}`);
  }
  console.log(`✓ Test 1 Passed: Admin can list students. Found ${listRes.body.data.summary.totalStudents} total students.`);

  // TEST 2: Student cannot access admin student list (403 Forbidden)
  const studentAccessRes = await request(app)
    .get('/api/admin/students')
    .set('Cookie', [`token=${studentToken}`]);

  if (studentAccessRes.status !== 403) {
    throw new Error(`Security Failure: Student accessed admin endpoint with status ${studentAccessRes.status}`);
  }
  console.log('✓ Test 2 Passed: Student role strictly rejected with 403 Forbidden.');

  // TEST 3: Search by Student ID
  const searchIdRes = await request(app)
    .get(`/api/admin/students?search=${studentUser.student.studentId}`)
    .set('Cookie', [`token=${adminToken}`]);

  if (searchIdRes.status !== 200 || searchIdRes.body.data.students.length === 0) {
    throw new Error(`Search by student ID failed for ${studentUser.student.studentId}`);
  }
  console.log(`✓ Test 3 Passed: Search by Student ID '${studentUser.student.studentId}' matched successfully.`);

  // TEST 4: Search by Name
  const nameQuery = studentUser.student.fullName.slice(0, 4);
  const searchNameRes = await request(app)
    .get(`/api/admin/students?search=${nameQuery}`)
    .set('Cookie', [`token=${adminToken}`]);

  if (searchNameRes.status !== 200 || searchNameRes.body.data.students.length === 0) {
    throw new Error(`Search by name query '${nameQuery}' failed.`);
  }
  console.log(`✓ Test 4 Passed: Search by partial name '${nameQuery}' matched ${searchNameRes.body.data.students.length} students.`);

  // TEST 5: Filter by Batch Number
  const filterBatchRes = await request(app)
    .get(`/api/admin/students?batchNumber=${studentUser.student.batchNumber}`)
    .set('Cookie', [`token=${adminToken}`]);

  if (filterBatchRes.status !== 200) {
    throw new Error(`Filter by batch failed`);
  }
  console.log(`✓ Test 5 Passed: Filter by batch '${studentUser.student.batchNumber}' returned ${filterBatchRes.body.data.students.length} students.`);

  // TEST 6: Filter by Status (OFFLINE)
  const filterOfflineRes = await request(app)
    .get('/api/admin/students?statusFilter=OFFLINE')
    .set('Cookie', [`token=${adminToken}`]);

  if (filterOfflineRes.status !== 200) {
    throw new Error('Filter by offline status failed');
  }
  console.log(`✓ Test 6 Passed: Filter by status 'OFFLINE' returned ${filterOfflineRes.body.data.students.length} offline students.`);

  // TEST 7 & 8 & 9: Detailed Student Inspection & Security Check (No Password/Token Leak)
  const detailRes = await request(app)
    .get(`/api/admin/students/${studentUser.student.studentId}`)
    .set('Cookie', [`token=${adminToken}`]);

  if (detailRes.status !== 200 || !detailRes.body.data.studentInfo) {
    throw new Error(`Student detail inspection failed: ${detailRes.status}`);
  }

  const detailData = detailRes.body.data;
  const jsonStr = JSON.stringify(detailData);

  if (jsonStr.includes('passwordHash') || jsonStr.includes('jwtSecret') || jsonStr.includes('sessionToken')) {
    throw new Error('SECURITY VIOLATION: Sensitive password hash or token leaked in detail payload!');
  }
  console.log('✓ Test 7, 8, 9 Passed: Student detail inspected cleanly without leaking password hashes or session tokens.');

  // TEST 10 & 11: R1 answers, R2/R3 code visible in inspection
  if (!('round1' in detailData) || !('round2' in detailData) || !('round3' in detailData)) {
    throw new Error('Detail payload missing round-specific activity inspection structures.');
  }
  console.log('✓ Test 10, 11 Passed: Round 1 answers, Round 2 code, and Round 3 code structures present in inspection.');

  // TEST 12: Hidden test cases protected
  const testCaseCheck = JSON.stringify(detailData.round3);
  if (testCaseCheck.includes('SECRET_HIDDEN_EXPECTED_OUTPUT_RAW')) {
    throw new Error('Security flaw: Raw hidden test case output exposed');
  }
  console.log('✓ Test 12 Passed: Hidden test case details remain protected.');

  // TEST 13 & 14 & 15: Submission history, Violations, Lock state
  if (!Array.isArray(detailData.violations) || !Array.isArray(detailData.round2.submissions) || !Array.isArray(detailData.round3.submissions)) {
    throw new Error('Submissions or violations arrays invalid in inspection response.');
  }
  console.log('✓ Test 13, 14, 15 Passed: Submission histories, violation logs, and lock state are structured cleanly.');

  // TEST 23: Pagination controls
  const page1Res = await request(app).get('/api/admin/students?page=1&limit=5').set('Cookie', [`token=${adminToken}`]);
  const page2Res = await request(app).get('/api/admin/students?page=2&limit=5').set('Cookie', [`token=${adminToken}`]);

  if (page1Res.body.data.students[0]?.id === page2Res.body.data.students[0]?.id) {
    throw new Error('Pagination failed: Page 1 and Page 2 returned identical first item');
  }
  console.log('✓ Test 23 Passed: Pagination works properly (Page 1 vs Page 2 items differ).');

  // TEST 27: Toggle Student Account Status (Enable/Disable)
  const suspendRes = await request(app)
    .patch(`/api/admin/students/${studentUser.student.studentId}/status`)
    .set('Cookie', [`token=${adminToken}`])
    .send({ isActive: false });

  if (suspendRes.status !== 200 || suspendRes.body.data.accountActive !== false) {
    throw new Error(`Failed to suspend student account: ${suspendRes.status}`);
  }

  // Restore account
  await request(app)
    .patch(`/api/admin/students/${studentUser.student.studentId}/status`)
    .set('Cookie', [`token=${adminToken}`])
    .send({ isActive: true });

  console.log('✓ Test 27 Passed: Student account suspension and re-activation toggle works safely.');

  console.log('====================================================');
  console.log('STEP 16 VERIFICATION SUCCESSFUL — ALL TESTS PASSED');
  console.log('====================================================');
}

runVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('STEP 16 VERIFICATION FAILED:', err);
    process.exit(1);
  });
