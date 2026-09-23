import assert from 'assert';
import { pool } from '../src/config/db.js';
import { attendanceRepository } from '../src/repositories/attendanceRepository.js';
import { employeeRepository } from '../src/repositories/employeeRepository.js';
import {
  parseShiftTiming,
  calculateWorkingHoursAndOvertime,
  calculateAutoLogoutCutoff,
  checkAndAutoLogoutRecord,
  createDateInTimezone,
  attendanceService,
} from '../src/services/attendanceService.js';

console.log('====================================================');
console.log('🔬 HRMS Attendance Auto-Logout & Tagging Audit E2E');
console.log('====================================================\n');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}\n${err.stack}`);
    failed++;
  }
}

async function runAudit() {
  const testOrgId = 'org-1';
  let testEmp = await employeeRepository.findById('emp-shubham-admin');
  if (!testEmp) {
    const allEmps = await employeeRepository.findAll(testOrgId);
    testEmp = allEmps[0];
  }
  assert(testEmp, 'Test employee must exist in the database');

  const adminUser = {
    id: 'user-superadmin-shubham',
    name: 'Shubham Admin',
    email: 'shubham@tasknera.com',
    roleName: 'Admin',
    orgId: testOrgId,
  };

  const employeeUser = {
    id: testEmp.userId || testEmp.id,
    name: `${testEmp.firstName} ${testEmp.lastName}`,
    email: testEmp.email,
    roleName: 'Employee',
    orgId: testOrgId,
  };

  // Helper to ensure clean slate for a test date
  const cleanDate = async (empId, dateStr) => {
    await pool.query('DELETE FROM attendance_records WHERE employee_id = $1 AND attendance_date = $2::date', [empId, dateStr]);
  };

  // =========================================================================
  // Section 1: 10-Hour Auto-Logout
  // =========================================================================
  console.log('\n--- 1. Testing 10-Hour Auto-Logout ---');

  await test('1.1: Auto-logout cutoff calculation is exactly 10 hours after shift end', () => {
    const checkIn = new Date('2026-09-22T05:30:00.000Z'); // 11:00 AM IST
    const rec = {
      attendanceDate: '2026-09-22',
      checkIn: checkIn.toISOString(),
      timezone: 'Asia/Kolkata',
    };
    const cutoff = calculateAutoLogoutCutoff(rec, '11:00 AM - 07:00 PM', 'Asia/Kolkata');
    assert(cutoff, 'Cutoff must be computed');

    // Shift ends at 07:00 PM IST (13:30 UTC). Cutoff +10h is 05:00 AM IST next day (23:30 UTC on 2026-09-22)
    const expectedCutoff = new Date('2026-09-22T23:30:00.000Z');
    assert.strictEqual(cutoff.getTime(), expectedCutoff.getTime(), 'Cutoff must be exactly 10h after shift end');
  });

  await test('1.2: Auto-logout executes when session exceeds cutoff and finalizes hours correctly', async () => {
    const testDate = '2026-08-01';
    await cleanDate(testEmp.id, testDate);

    const testRecordId = `att-test-autologout-${Date.now()}`;
    const checkIn = new Date('2026-08-01T05:30:00.000Z'); // 11:00 AM IST

    const created = await attendanceRepository.create({
      id: testRecordId,
      orgId: testOrgId,
      employeeId: testEmp.id,
      attendanceDate: testDate,
      timezone: 'Asia/Kolkata',
      checkIn,
      checkOut: null,
      totalHours: 0.0,
      status: 'PRESENT',
      breakDurationMinutes: 0,
      overtimeHours: 0.0,
      notes: '',
    });

    const updated = await checkAndAutoLogoutRecord(created, '11:00 AM - 07:00 PM', true);

    // Verify checkout timestamp is set to cutoff time (05:00 AM next day IST = 23:30 UTC)
    const expectedCheckout = new Date('2026-08-01T23:30:00.000Z');
    assert.strictEqual(new Date(updated.checkOut).getTime(), expectedCheckout.getTime());
    assert.strictEqual(Number(updated.totalHours), 18.0);
    assert.strictEqual(Number(updated.overtimeHours), 10.0);
    assert(updated.notes.includes('[SYSTEM_AUTO_LOGOUT]'));
    assert(updated.notes.includes('[NEEDS_POST_SHIFT_REMARK]'));

    await pool.query('DELETE FROM attendance_records WHERE id = $1', [testRecordId]);
  });

  // =========================================================================
  // Section 2: Manual Logout
  // =========================================================================
  console.log('\n--- 2. Testing Manual Logout Protection ---');

  await test('2.1: Manual logout before 10 hours is never overwritten by auto-logout', async () => {
    const testDate = '2026-08-02';
    await cleanDate(testEmp.id, testDate);

    const testRecordId = `att-test-manual-${Date.now()}`;
    const checkIn = new Date('2026-08-02T05:30:00.000Z'); // 11:00 AM IST
    const manualCheckOut = new Date('2026-08-02T13:45:00.000Z'); // 07:15 PM IST (8.25h gross)

    const created = await attendanceRepository.create({
      id: testRecordId,
      orgId: testOrgId,
      employeeId: testEmp.id,
      attendanceDate: testDate,
      timezone: 'Asia/Kolkata',
      checkIn,
      checkOut: manualCheckOut,
      totalHours: 8.25,
      status: 'PRESENT',
      breakDurationMinutes: 0,
      overtimeHours: 0.25,
      notes: 'Manual checkout by employee',
    });

    const result = await checkAndAutoLogoutRecord(created, '11:00 AM - 07:00 PM', true);

    assert.strictEqual(new Date(result.checkOut).getTime(), manualCheckOut.getTime());
    assert.strictEqual(Number(result.totalHours), 8.25);
    assert.strictEqual(Number(result.overtimeHours), 0.25);
    assert(!result.notes.includes('[SYSTEM_AUTO_LOGOUT]'));

    await pool.query('DELETE FROM attendance_records WHERE id = $1', [testRecordId]);
  });

  // =========================================================================
  // Section 3: Next-Day Tags (OT, Mistake, Emergency)
  // =========================================================================
  console.log('\n--- 3. Testing Next-Day Tags ---');

  await test('3.1: Tag as OT preserves working hours and records classification', async () => {
    const testDate = '2026-08-03';
    await cleanDate(testEmp.id, testDate);

    const testRecordId = `att-test-tag-ot-${Date.now()}`;
    const checkIn = new Date('2026-08-03T05:30:00.000Z');
    const autoCheckOut = new Date('2026-08-03T23:30:00.000Z'); // 18h

    await attendanceRepository.create({
      id: testRecordId,
      orgId: testOrgId,
      employeeId: testEmp.id,
      attendanceDate: testDate,
      timezone: 'Asia/Kolkata',
      checkIn,
      checkOut: autoCheckOut,
      totalHours: 18.0,
      status: 'PRESENT',
      breakDurationMinutes: 0,
      overtimeHours: 10.0,
      notes: '[SYSTEM_AUTO_LOGOUT] [NEEDS_POST_SHIFT_REMARK]',
    });

    const tagged = await attendanceService.addShiftRemark(adminUser, testRecordId, {
      remarkType: 'OT',
      comments: 'Worked through the night on production rollout',
    });

    assert.strictEqual(Number(tagged.totalHours), 18.0, 'Total hours must be preserved');
    assert.strictEqual(Number(tagged.overtimeHours), 10.0, 'Overtime hours must be preserved');
    assert.strictEqual(new Date(tagged.checkOut).getTime(), autoCheckOut.getTime(), 'Check-out timestamp preserved');
    assert(!tagged.notes.includes('[NEEDS_POST_SHIFT_REMARK]'), '[NEEDS_POST_SHIFT_REMARK] must be stripped');
    assert(tagged.notes.includes('[POST_SHIFT_REMARK: OT]'), 'Audit tag must be appended');
    assert.strictEqual(tagged.regularizationReason, '[OT] Worked through the night on production rollout');

    await pool.query('DELETE FROM attendance_records WHERE id = $1', [testRecordId]);
  });

  await test('3.2: Tag as MISTAKE resets overtime to 0.00 and normalizes duration to assigned shift', async () => {
    const testDate = '2026-08-04';
    await cleanDate(testEmp.id, testDate);

    const testRecordId = `att-test-tag-mistake-${Date.now()}`;
    const checkIn = new Date('2026-08-04T05:30:00.000Z'); // 11:00 AM IST
    const autoCheckOut = new Date('2026-08-04T23:30:00.000Z'); // 05:00 AM IST next day

    await attendanceRepository.create({
      id: testRecordId,
      orgId: testOrgId,
      employeeId: testEmp.id,
      attendanceDate: testDate,
      timezone: 'Asia/Kolkata',
      checkIn,
      checkOut: autoCheckOut,
      totalHours: 18.0,
      status: 'PRESENT',
      breakDurationMinutes: 15,
      overtimeHours: 9.75,
      notes: '[SYSTEM_AUTO_LOGOUT] [NEEDS_POST_SHIFT_REMARK]',
    });

    const tagged = await attendanceService.addShiftRemark(adminUser, testRecordId, {
      remarkType: 'MISTAKE',
      comments: 'Forgot to logout when leaving office',
    });

    assert.strictEqual(Number(tagged.overtimeHours), 0.0, 'Overtime must be voided');
    assert.strictEqual(Number(tagged.totalHours), 8.0, 'Total hours must be normalized to scheduled shift');

    const expectedAdjustedOut = new Date(checkIn.getTime() + 8 * 3600 * 1000 + 15 * 60 * 1000);
    assert.strictEqual(new Date(tagged.checkOut).getTime(), expectedAdjustedOut.getTime());
    assert(!tagged.notes.includes('[NEEDS_POST_SHIFT_REMARK]'));
    assert(tagged.notes.includes('[POST_SHIFT_REMARK: MISTAKE]'));

    await pool.query('DELETE FROM attendance_records WHERE id = $1', [testRecordId]);
  });

  await test('3.3: Tag as EMERGENCY preserves working duration and records justification', async () => {
    const testDate = '2026-08-05';
    await cleanDate(testEmp.id, testDate);

    const testRecordId = `att-test-tag-emg-${Date.now()}`;
    const checkIn = new Date('2026-08-05T05:30:00.000Z');
    const checkOut = new Date('2026-08-05T19:30:00.000Z'); // 14 hours

    await attendanceRepository.create({
      id: testRecordId,
      orgId: testOrgId,
      employeeId: testEmp.id,
      attendanceDate: testDate,
      timezone: 'Asia/Kolkata',
      checkIn,
      checkOut,
      totalHours: 14.0,
      status: 'PRESENT',
      breakDurationMinutes: 0,
      overtimeHours: 6.0,
      notes: '[SYSTEM_AUTO_LOGOUT] [NEEDS_POST_SHIFT_REMARK]',
    });

    const tagged = await attendanceService.addShiftRemark(adminUser, testRecordId, {
      remarkType: 'EMERGENCY',
      comments: 'Server outage emergency repair',
    });

    assert.strictEqual(Number(tagged.totalHours), 14.0);
    assert.strictEqual(Number(tagged.overtimeHours), 6.0);
    assert(tagged.notes.includes('[POST_SHIFT_REMARK: EMERGENCY]'));

    await pool.query('DELETE FROM attendance_records WHERE id = $1', [testRecordId]);
  });

  // =========================================================================
  // Section 4: Edge Cases
  // =========================================================================
  console.log('\n--- 4. Testing Edge Cases ---');

  await test('4.1: Late check-in shifts dynamic cutoff accordingly', () => {
    const checkIn = new Date('2026-09-22T14:30:00.000Z'); // 08:00 PM IST (late)
    const rec = {
      attendanceDate: '2026-09-22',
      checkIn: checkIn.toISOString(),
      timezone: 'Asia/Kolkata',
    };
    const cutoff = calculateAutoLogoutCutoff(rec, '11:00 AM - 07:00 PM', 'Asia/Kolkata');

    // Dynamic shift end = 08:00 PM + 8h = 04:00 AM IST next day (22:30 UTC on 2026-09-22)
    // Cutoff = 04:00 AM + 10h = 02:00 PM IST next day (08:30 UTC on 2026-09-23)
    const expectedCutoff = new Date('2026-09-23T08:30:00.000Z');
    assert.strictEqual(cutoff.getTime(), expectedCutoff.getTime());
  });

  await test('4.2: Overnight shift crossing midnight computes correct cutoff and duration', () => {
    // Shift: 06:08 PM - 07:00 AM
    // Check-in on 2026-09-22 at 06:08 PM IST (12:38 UTC)
    const checkIn = new Date('2026-09-22T12:38:00.000Z');
    const rec = {
      attendanceDate: '2026-09-22',
      checkIn: checkIn.toISOString(),
      timezone: 'Asia/Kolkata',
    };
    const cutoff = calculateAutoLogoutCutoff(rec, '06:08 PM - 07:00 AM', 'Asia/Kolkata');

    // Shift end is 2026-09-23 07:00 AM IST (01:30 UTC on 2026-09-23)
    // Cutoff is +10h = 2026-09-23 05:00 PM IST (11:30 UTC on 2026-09-23)
    const expectedCutoff = new Date('2026-09-23T11:30:00.000Z');
    assert.strictEqual(cutoff.getTime(), expectedCutoff.getTime(), 'Overnight cutoff must cross midnight to next day');
  });

  await test('4.3: Multi-session breaks are subtracted accurately from gross duration', () => {
    const login = new Date('2026-09-22T09:00:00.000Z');
    const logout = new Date('2026-09-22T18:00:00.000Z'); // 9.0h gross
    const breakHistory = [
      { durationSeconds: 600 },   // 10 mins
      { durationSeconds: 1200 },  // 20 mins
      { durationMinutes: 15 },    // 15 mins
    ];
    const res = calculateWorkingHoursAndOvertime({
      checkIn: login,
      checkOut: logout,
      breakHistory,
      shiftTiming: '11:00 AM - 07:00 PM',
    });

    assert.strictEqual(res.grossHours, 9.0);
    assert.strictEqual(res.breakDurationMinutes, 45);
    assert.strictEqual(res.totalHours, 8.25);
    assert.strictEqual(res.overtimeHours, 0.25);
  });

  await test('4.4: 18h shift produces 0.00 overtime when worked <= 18h', () => {
    const login = new Date('2026-09-22T13:21:00.000Z');
    const logout = new Date('2026-09-22T23:34:00.000Z');
    const res = calculateWorkingHoursAndOvertime({
      checkIn: login,
      checkOut: logout,
      breakDurationMinutes: 22,
      shiftTiming: '1:00 AM–7:00 PM',
    });

    assert.strictEqual(res.totalHours, 9.85);
    assert.strictEqual(res.overtimeHours, 0.0);
    assert.strictEqual(res.scheduledDurationHours, 18.0);
  });

  await test('4.5: Unauthorized employee cannot tag another employee record', async () => {
    const testDate = '2026-08-06';
    await cleanDate(testEmp.id, testDate);

    const testRecordId = `att-test-auth-${Date.now()}`;
    await attendanceRepository.create({
      id: testRecordId,
      orgId: testOrgId,
      employeeId: testEmp.id,
      attendanceDate: testDate,
      checkIn: new Date(),
      status: 'PRESENT',
    });

    // Another employee tries to tag testEmp's record
    const anotherUser = {
      id: 'user-another-emp',
      roleName: 'Employee',
      orgId: testOrgId,
      email: 'another@example.com',
    };

    let caughtError = null;
    try {
      await attendanceService.addShiftRemark(anotherUser, testRecordId, {
        remarkType: 'OT',
        comments: 'Attempting unauthorized tag',
      });
    } catch (err) {
      caughtError = err;
    }

    assert(caughtError, 'Must throw error when employee tags another record');
    assert.strictEqual(caughtError.statusCode, 403);

    await pool.query('DELETE FROM attendance_records WHERE id = $1', [testRecordId]);
  });

  await test('4.6: Invalid tag type or short comments are rejected', async () => {
    const testDate = '2026-08-07';
    await cleanDate(testEmp.id, testDate);

    const testRecordId = `att-test-validate-${Date.now()}`;
    await attendanceRepository.create({
      id: testRecordId,
      orgId: testOrgId,
      employeeId: testEmp.id,
      attendanceDate: testDate,
      checkIn: new Date(),
      status: 'PRESENT',
    });

    // 1. Invalid remarkType
    let typeErr = null;
    try {
      await attendanceService.addShiftRemark(adminUser, testRecordId, {
        remarkType: 'INVALID_TYPE',
        comments: 'Valid comment',
      });
    } catch (err) {
      typeErr = err;
    }
    assert(typeErr && typeErr.statusCode === 400);

    // 2. Short comments (< 3 chars)
    let commentErr = null;
    try {
      await attendanceService.addShiftRemark(adminUser, testRecordId, {
        remarkType: 'OT',
        comments: 'ok',
      });
    } catch (err) {
      commentErr = err;
    }
    assert(commentErr && commentErr.statusCode === 400);

    await pool.query('DELETE FROM attendance_records WHERE id = $1', [testRecordId]);
  });

  // =========================================================================
  // Section 5: Persistence & Consistency after Re-fetch
  // =========================================================================
  console.log('\n--- 5. Testing Persistence & Consistency ---');

  await test('5.1: Record remains completely consistent after database re-fetch', async () => {
    const testDate = '2026-08-08';
    await cleanDate(testEmp.id, testDate);

    const testRecordId = `att-test-persist-${Date.now()}`;
    const checkIn = new Date('2026-08-08T05:30:00.000Z');
    const checkOut = new Date('2026-08-08T14:45:00.000Z');

    await attendanceRepository.create({
      id: testRecordId,
      orgId: testOrgId,
      employeeId: testEmp.id,
      attendanceDate: testDate,
      timezone: 'Asia/Kolkata',
      checkIn,
      checkOut,
      totalHours: 9.0,
      breakDurationMinutes: 15,
      overtimeHours: 1.0,
      status: 'PRESENT',
      notes: 'Initial session',
    });

    const fetched = await attendanceRepository.findById(testRecordId);
    assert.strictEqual(Number(fetched.totalHours), 9.0);
    assert.strictEqual(Number(fetched.overtimeHours), 1.0);
    assert.strictEqual(fetched.breakDurationMinutes, 15);
    assert.strictEqual(new Date(fetched.checkIn).getTime(), checkIn.getTime());
    assert.strictEqual(new Date(fetched.checkOut).getTime(), checkOut.getTime());

    await pool.query('DELETE FROM attendance_records WHERE id = $1', [testRecordId]);
  });

  console.log('\n====================================================');
  console.log(`Audit Complete: ${passed} Passed, ${failed} Failed.`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAudit();
