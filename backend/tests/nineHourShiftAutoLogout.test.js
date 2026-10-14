import assert from 'node:assert';
import {
  calculateAutoLogoutCutoff,
  checkAndAutoLogoutRecord,
  resolveShiftForEmployeeAndDate,
} from '../src/services/attendanceService.js';
import { parseShiftTiming } from '../src/utils/shiftUtils.js';

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    throw err;
  }
};

const runSuite = async () => {
  console.log('================================================================');
  console.log('🧪 Running 9-Hour Shift Schedule Auto-Logout Test Suite');
  console.log('================================================================\n');

  console.log('--- 1. Shift Parsing for 9-Hour Shifts ---');
  await test('parseShiftTiming correctly parses "11:00 AM - 08:00 PM" as 9.0 hours', () => {
    const s = parseShiftTiming('11:00 AM - 08:00 PM');
    assert.strictEqual(s.startHour, 11);
    assert.strictEqual(s.endHour, 20);
    assert.strictEqual(s.scheduledDurationHours, 9.0);
  });

  await test('parseShiftTiming correctly parses "11 - 8 PM" as 9.0 hours', () => {
    const s = parseShiftTiming('11 - 8 PM');
    assert.strictEqual(s.startHour, 11);
    assert.strictEqual(s.endHour, 20);
    assert.strictEqual(s.scheduledDurationHours, 9.0);
  });

  await test('parseShiftTiming correctly parses "10:00 AM - 07:00 PM" as 9.0 hours', () => {
    const s = parseShiftTiming('10:00 AM - 07:00 PM');
    assert.strictEqual(s.startHour, 10);
    assert.strictEqual(s.endHour, 19);
    assert.strictEqual(s.scheduledDurationHours, 9.0);
  });

  console.log('\n--- 2. Cutoff Calculation for 9-Hour Shifts ---');
  await test('Calculates cutoff as 08:20 PM (not 07:20 PM) for 11:00 AM - 08:00 PM 9h shift', () => {
    const record = {
      attendanceDate: '2026-10-14',
      checkIn: new Date('2026-10-14T05:30:00.000Z'), // 11:00 AM IST
      timezone: 'Asia/Kolkata',
    };
    const cutoff = calculateAutoLogoutCutoff(record, '11:00 AM - 08:00 PM', 'Asia/Kolkata', 20);
    assert(cutoff, 'Cutoff should be calculated');
    // 08:20 PM IST = 14:50 UTC
    assert.strictEqual(cutoff.toISOString(), '2026-10-14T14:50:00.000Z');
  });

  await test('Calculates cutoff as 08:20 PM for "11 - 8 PM" 9h shift', () => {
    const record = {
      attendanceDate: '2026-10-14',
      checkIn: new Date('2026-10-14T05:30:00.000Z'), // 11:00 AM IST
      timezone: 'Asia/Kolkata',
    };
    const cutoff = calculateAutoLogoutCutoff(record, '11 - 8 PM', 'Asia/Kolkata', 20);
    assert(cutoff, 'Cutoff should be calculated');
    assert.strictEqual(cutoff.toISOString(), '2026-10-14T14:50:00.000Z');
  });

  await test('Late check-in at 11:30 AM on 9h shift extends cutoff to at least 08:50 PM', () => {
    const record = {
      attendanceDate: '2026-10-14',
      checkIn: new Date('2026-10-14T06:00:00.000Z'), // 11:30 AM IST
      timezone: 'Asia/Kolkata',
    };
    const cutoff = calculateAutoLogoutCutoff(record, '11:00 AM - 08:00 PM', 'Asia/Kolkata', 20);
    assert(cutoff, 'Cutoff should be calculated');
    // 11:30 AM IST + 9h + 20m = 08:50 PM IST = 15:20 UTC
    assert.strictEqual(cutoff.toISOString(), '2026-10-14T15:20:00.000Z');
  });

  console.log('\n--- 3. Preventing Auto-Logout at 8 Hours ---');
  await test('At 8 hours (07:00 PM IST) into 9-hour shift, record is NOT auto-logged out', async () => {
    const record = {
      id: 'test-rec-9h',
      attendanceDate: '2026-10-14',
      checkIn: new Date('2026-10-14T05:30:00.000Z'), // 11:00 AM IST
      checkOut: null,
      timezone: 'Asia/Kolkata',
      employee: {
        shiftTiming: '11 - 8 PM',
      },
    };

    // Calculate cutoff for 9h shift
    const cutoff = calculateAutoLogoutCutoff(record, '11 - 8 PM', 'Asia/Kolkata', 20);
    // Simulated time: 7:20 PM IST (13:50 UTC) -> exactly when 8-hour shift would have timed out
    const simulatedCurrentTime = new Date('2026-10-14T13:50:00.000Z');

    assert(
      simulatedCurrentTime.getTime() < cutoff.getTime(),
      'Current time at 8h grace (07:20 PM) must be strictly BEFORE 9h cutoff (08:20 PM)'
    );
  });

  console.log('\n================================================================');
  console.log('Results: All tests passed successfully!');
  console.log('================================================================');
};

runSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
