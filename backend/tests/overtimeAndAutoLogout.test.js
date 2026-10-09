import assert from 'assert';
import {
  calculateAutoLogoutCutoff,
  checkAndAutoLogoutRecord,
  createDateInTimezone,
} from '../src/services/attendanceService.js';
import { overtimeService } from '../src/services/overtimeService.js';
import { overtimeRepository } from '../src/repositories/overtimeRepository.js';
import { attendanceRepository } from '../src/repositories/attendanceRepository.js';
import { employeeRepository } from '../src/repositories/employeeRepository.js';
import { enforceActiveWorkday } from '../src/middleware/workdayMiddleware.js';
import { pool } from '../src/config/db.js';

console.log('================================================================');
console.log('🧪 Running Auto-Logout & Overtime Tracking Test Suite');
console.log('================================================================\n');

let passedTests = 0;
let failedTests = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

async function runTests() {
  // -------------------------------------------------------------
  // 1. Shift End & 20-Minute Grace Cutoff Calculations
  // -------------------------------------------------------------
  console.log('--- 1. Shift End + 20-Minute Grace Cutoff Calculation ---');

  await test('Calculates cutoff as 07:20 PM for 11:00 AM - 07:00 PM shift', () => {
    const record = {
      attendanceDate: '2026-10-09',
      checkIn: '2026-10-09T05:30:00.000Z', // 11:00 AM IST
      timezone: 'Asia/Kolkata',
    };
    const cutoff = calculateAutoLogoutCutoff(record, '11:00 AM - 07:00 PM', 'Asia/Kolkata', 20);
    assert(cutoff instanceof Date, 'Cutoff should be a Date object');

    // In Asia/Kolkata, 7:20 PM is 13:50:00 UTC (19:20 - 5:30)
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const formatted = formatter.format(cutoff);
    assert.strictEqual(formatted, '19:20', `Expected 19:20 IST but got ${formatted}`);
  });

  await test('Calculates cutoff as 05:20 PM for 09:00 AM - 05:00 PM shift', () => {
    const record = {
      attendanceDate: '2026-10-09',
      checkIn: '2026-10-09T03:30:00.000Z', // 09:00 AM IST
      timezone: 'Asia/Kolkata',
    };
    const cutoff = calculateAutoLogoutCutoff(record, '09:00 AM - 05:00 PM', 'Asia/Kolkata', 20);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const formatted = formatter.format(cutoff);
    assert.strictEqual(formatted, '17:20', `Expected 17:20 IST but got ${formatted}`);
  });

  await test('Calculates cutoff as 06:20 PM for 10:00 AM - 06:00 PM shift', () => {
    const record = {
      attendanceDate: '2026-10-09',
      checkIn: '2026-10-09T04:30:00.000Z',
      timezone: 'Asia/Kolkata',
    };
    const cutoff = calculateAutoLogoutCutoff(record, '10:00 AM - 06:00 PM', 'Asia/Kolkata', 20);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const formatted = formatter.format(cutoff);
    assert.strictEqual(formatted, '18:20', `Expected 18:20 IST but got ${formatted}`);
  });

  await test('Calculates cutoff as 08:20 PM for 12:00 PM - 08:00 PM shift', () => {
    const record = {
      attendanceDate: '2026-10-09',
      checkIn: '2026-10-09T06:30:00.000Z',
      timezone: 'Asia/Kolkata',
    };
    const cutoff = calculateAutoLogoutCutoff(record, '12:00 PM - 08:00 PM', 'Asia/Kolkata', 20);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const formatted = formatter.format(cutoff);
    assert.strictEqual(formatted, '20:20', `Expected 20:20 IST but got ${formatted}`);
  });

  await test('Handles overnight shift 10:00 PM - 06:00 AM with next-day 06:20 AM cutoff', () => {
    const record = {
      attendanceDate: '2026-10-09',
      checkIn: '2026-10-09T16:30:00.000Z', // 10:00 PM IST
      timezone: 'Asia/Kolkata',
    };
    const cutoff = calculateAutoLogoutCutoff(record, '10:00 PM - 06:00 AM', 'Asia/Kolkata', 20);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      hour12: false,
    });
    const formatted = formatter.format(cutoff);
    assert(formatted.includes('06:20'), `Expected 06:20 IST but got ${formatted}`);
  });

  // -------------------------------------------------------------
  // 2. Auto-Logout Record Finalization
  // -------------------------------------------------------------
  console.log('\n--- 2. Auto-Logout Finalization & Break Closing ---');

  await test('Auto-logout finalizes unclosed record at scheduled cutoff with notes', async () => {
    const fakeRecord = {
      id: 'test-att-auto-1',
      attendanceDate: '2026-10-01',
      checkIn: new Date('2026-10-01T05:30:00.000Z'), // 11:00 AM IST
      checkOut: null,
      timezone: 'Asia/Kolkata',
      isOnBreak: true,
      currentBreakStart: new Date('2026-10-01T08:30:00.000Z'), // 2:00 PM IST
      breakHistory: [],
      notes: 'Initial checkin',
      employee: { shiftTiming: '11:00 AM - 07:00 PM' },
    };

    // Mock update
    const origUpdate = attendanceRepository.update;
    let updatedPayload = null;
    attendanceRepository.update = async (id, data) => {
      updatedPayload = { id, ...data };
      return updatedPayload;
    };

    try {
      const result = await checkAndAutoLogoutRecord(fakeRecord, '11:00 AM - 07:00 PM');
      assert(updatedPayload, 'Record update must be called');
      assert(updatedPayload.checkOut, 'checkOut must be populated');
      assert(updatedPayload.notes.includes('[SYSTEM_AUTO_LOGOUT]'), 'Notes must record [SYSTEM_AUTO_LOGOUT]');
      assert(updatedPayload.notes.includes('20-minute shift grace period'), 'Notes must mention 20-minute shift grace period');
      assert.strictEqual(updatedPayload.isOnBreak, false, 'isOnBreak must be set to false');
      assert.strictEqual(updatedPayload.currentBreakStart, null, 'currentBreakStart must be cleared');
      assert(updatedPayload.breakHistory.length === 1, 'Open break session must be finalized into breakHistory');
    } finally {
      attendanceRepository.update = origUpdate;
    }
  });

  await test('Idempotent: Already closed attendance record is returned without modification', async () => {
    const closedRecord = {
      id: 'test-att-closed-1',
      checkIn: new Date('2026-10-01T05:30:00.000Z'),
      checkOut: new Date('2026-10-01T13:30:00.000Z'),
    };
    const result = await checkAndAutoLogoutRecord(closedRecord, '11:00 AM - 07:00 PM');
    assert.strictEqual(result, closedRecord, 'Already closed record must return as-is');
  });

  // -------------------------------------------------------------
  // 3. Overtime Service Rules & Validations
  // -------------------------------------------------------------
  console.log('\n--- 3. Overtime Validation & Lifecycle ---');

  await test('Overtime login rejected if employee has not completed regular shift attendance', async () => {
    const mockUser = {
      id: 'test-user-ot',
      employeeId: 'test-emp-ot',
      orgId: 'test-org-ot',
      roleName: 'Employee',
    };

    const origFindByUserId = employeeRepository.findByUserId;
    employeeRepository.findByUserId = async () => ({
      id: 'test-emp-ot',
      orgId: 'test-org-ot',
      shiftTiming: '11:00 AM - 07:00 PM',
      status: 'active',
    });

    // Mock attendanceRepository to return unclosed record
    const origFindByDate = attendanceRepository.findByEmployeeAndDate;
    const origFindUnclosed = attendanceRepository.findActiveUnclosedRecords;
    attendanceRepository.findByEmployeeAndDate = async () => ({
      id: 'att-open',
      checkIn: new Date(),
      checkOut: null, // still active!
    });
    attendanceRepository.findActiveUnclosedRecords = async () => [];

    try {
      await overtimeService.loginOvertime(mockUser);
      assert.fail('Should have thrown error when regular attendance is not closed');
    } catch (err) {
      assert(err.message.includes('Overtime login is only permitted after your regular attendance session has ended'), `Unexpected error message: ${err.message}`);
    } finally {
      employeeRepository.findByUserId = origFindByUserId;
      attendanceRepository.findByEmployeeAndDate = origFindByDate;
      attendanceRepository.findActiveUnclosedRecords = origFindUnclosed;
    }
  });

  await test('Overtime logout rejected if no active overtime session exists', async () => {
    const mockUser = {
      id: 'test-user-ot',
      employeeId: 'test-emp-ot',
      orgId: 'test-org-ot',
      roleName: 'Employee',
    };

    const origFindByUserId = employeeRepository.findByUserId;
    employeeRepository.findByUserId = async () => ({
      id: 'test-emp-ot',
      orgId: 'test-org-ot',
      shiftTiming: '11:00 AM - 07:00 PM',
      status: 'active',
    });

    const origFindActive = overtimeRepository.findActiveByEmployee;
    overtimeRepository.findActiveByEmployee = async () => null;

    try {
      await overtimeService.logoutOvertime(mockUser);
      assert.fail('Should have thrown error when no overtime session is active');
    } catch (err) {
      assert(err.message.includes('No active overtime session found'), `Unexpected error message: ${err.message}`);
    } finally {
      employeeRepository.findByUserId = origFindByUserId;
      overtimeRepository.findActiveByEmployee = origFindActive;
    }
  });

  // -------------------------------------------------------------
  // 4. Workday Enforcement & Overtime Exemption
  // -------------------------------------------------------------
  console.log('\n--- 4. Workday Middleware Overtime Exemption ---');

  await test('Workday middleware permits POST /api/v1/attendance/overtime/login even after regular shift logout', async () => {
    const req = {
      method: 'POST',
      originalUrl: '/api/v1/attendance/overtime/login',
      path: '/api/v1/attendance/overtime/login',
      user: {
        id: 'user-ot-1',
        employeeId: 'emp-ot-1',
        roleName: 'Employee',
      },
    };
    let nextCalled = false;
    let statusCode = 200;
    const res = {
      status(c) { statusCode = c; return this; },
      json(d) { return d; },
    };
    await enforceActiveWorkday(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true, 'Next must be called for overtime endpoint');
  });

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`Results: ${passedTests} Passed, ${failedTests} Failed`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().then(() => {
  pool.end();
}).catch((err) => {
  console.error('Test suite uncaught error:', err);
  pool.end();
  process.exit(1);
});
