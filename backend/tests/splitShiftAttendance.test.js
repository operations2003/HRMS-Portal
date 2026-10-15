import assert from 'assert';
import {
  parseShiftTiming,
  getSlotForTimestamp,
} from '../src/utils/shiftUtils.js';
import {
  calculateAutoLogoutCutoff,
} from '../src/services/attendanceService.js';

console.log('================================================================');
console.log('🧪 Running Split Shift & Multi-Session Attendance Test Suite');
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
  const atulShift = '01:00 PM - 04:00 PM, 10:00 PM - 01:00 AM';

  // -------------------------------------------------------------
  // 1. Shift Parsing for Split Shifts
  // -------------------------------------------------------------
  console.log('--- 1. Shift Parsing for Split Shifts ---');

  await test('Parses Atul split shift timing correctly', () => {
    const parsed = parseShiftTiming(atulShift);
    assert(parsed !== null, 'Parsed shift should not be null');
    assert.strictEqual(parsed.isSplitShift, true, 'isSplitShift should be true');
    assert.strictEqual(parsed.isOvernight, true, 'isOvernight should be true because Slot 2 crosses midnight');
    assert.strictEqual(parsed.slots.length, 2, 'Should have exactly 2 slots');
    assert.strictEqual(parsed.scheduledDurationHours, 6.0, 'Total scheduled hours should be 6.0');

    // Slot 1: 13:00 - 16:00
    assert.strictEqual(parsed.slots[0].startHour, 13);
    assert.strictEqual(parsed.slots[0].startMinute, 0);
    assert.strictEqual(parsed.slots[0].endHour, 16);
    assert.strictEqual(parsed.slots[0].endMinute, 0);
    assert.strictEqual(parsed.slots[0].durationHours, 3.0);
    assert.strictEqual(parsed.slots[0].isOvernight, false);

    // Slot 2: 22:00 - 01:00
    assert.strictEqual(parsed.slots[1].startHour, 22);
    assert.strictEqual(parsed.slots[1].startMinute, 0);
    assert.strictEqual(parsed.slots[1].endHour, 1);
    assert.strictEqual(parsed.slots[1].endMinute, 0);
    assert.strictEqual(parsed.slots[1].durationHours, 3.0);
    assert.strictEqual(parsed.slots[1].isOvernight, true);
  });

  // -------------------------------------------------------------
  // 2. Active Slot Detection Based on Current Time
  // -------------------------------------------------------------
  console.log('--- 2. Active Slot Detection ---');

  await test('Matches Slot 1 (1 PM - 4 PM) when time is 1:05 PM IST', () => {
    // 2026-10-15 13:05:00 IST is 2026-10-15T07:35:00.000Z
    const timestamp = '2026-10-15T07:35:00.000Z';
    const activeSlot = getSlotForTimestamp(atulShift, timestamp, 'Asia/Kolkata');
    assert(activeSlot !== null, 'Active slot should be found');
    assert.strictEqual(activeSlot.slotIndex, 1);
    assert.strictEqual(activeSlot.index, 0);
    assert.strictEqual(activeSlot.label, '01:00 PM - 04:00 PM');
  });

  await test('Matches Slot 1 when checking in slightly early at 12:45 PM IST', () => {
    // 2026-10-15 12:45:00 IST is 2026-10-15T07:15:00.000Z
    const timestamp = '2026-10-15T07:15:00.000Z';
    const activeSlot = getSlotForTimestamp(atulShift, timestamp, 'Asia/Kolkata');
    assert(activeSlot !== null, 'Active slot should be found');
    assert.strictEqual(activeSlot.slotIndex, 1);
    assert.strictEqual(activeSlot.index, 0);
  });

  await test('Matches Slot 2 (10 PM - 1 AM) when time is 10:00 PM IST', () => {
    // 2026-10-15 22:00:00 IST is 2026-10-15T16:30:00.000Z
    const timestamp = '2026-10-15T16:30:00.000Z';
    const activeSlot = getSlotForTimestamp(atulShift, timestamp, 'Asia/Kolkata');
    assert(activeSlot !== null, 'Active slot should be found');
    assert.strictEqual(activeSlot.slotIndex, 2);
    assert.strictEqual(activeSlot.index, 1);
    assert.strictEqual(activeSlot.label, '10:00 PM - 01:00 AM');
  });

  await test('Matches Slot 2 when time is past midnight at 12:30 AM IST (next day)', () => {
    // 2026-10-16 00:30:00 IST is 2026-10-15T19:00:00.000Z
    const timestamp = '2026-10-15T19:00:00.000Z';
    const activeSlot = getSlotForTimestamp(atulShift, timestamp, 'Asia/Kolkata');
    assert(activeSlot !== null, 'Active slot should be found');
    assert.strictEqual(activeSlot.slotIndex, 2);
    assert.strictEqual(activeSlot.index, 1);
  });

  // -------------------------------------------------------------
  // 3. Auto-Logout Cutoff Calculation for Each Slot
  // -------------------------------------------------------------
  console.log('--- 3. Auto-Logout Cutoffs for Split Shifts ---');

  await test('Slot 1 check-in at 1:00 PM IST calculates cutoff at 04:20 PM IST (same day)', () => {
    const record = {
      attendanceDate: '2026-10-15',
      checkIn: '2026-10-15T07:30:00.000Z', // 1:00 PM IST
      timezone: 'Asia/Kolkata',
      sessions: [
        {
          sessionIndex: 1,
          slotLabel: '01:00 PM - 04:00 PM',
          checkIn: '2026-10-15T07:30:00.000Z',
          checkOut: null,
        },
      ],
    };

    const cutoff = calculateAutoLogoutCutoff(record, atulShift, 'Asia/Kolkata', 20);
    assert(cutoff instanceof Date, 'Cutoff should be a Date');

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const formatted = formatter.format(cutoff);
    // 10/15/2026, 16:20
    assert(formatted.includes('16:20'), `Expected 16:20 IST but got ${formatted}`);
  });

  await test('Slot 2 check-in at 10:00 PM IST calculates cutoff at 01:20 AM IST (next day)', () => {
    const record = {
      attendanceDate: '2026-10-15',
      checkIn: '2026-10-15T07:30:00.000Z', // initial check-in of day (Shift 1)
      timezone: 'Asia/Kolkata',
      sessions: [
        {
          sessionIndex: 1,
          slotLabel: '01:00 PM - 04:00 PM',
          checkIn: '2026-10-15T07:30:00.000Z',
          checkOut: '2026-10-15T10:30:00.000Z', // 4:00 PM IST
          durationHours: 3.0,
        },
        {
          sessionIndex: 2,
          slotLabel: '10:00 PM - 01:00 AM',
          checkIn: '2026-10-15T16:30:00.000Z', // 10:00 PM IST
          checkOut: null,
        },
      ],
    };

    const cutoff = calculateAutoLogoutCutoff(record, atulShift, 'Asia/Kolkata', 20);
    assert(cutoff instanceof Date, 'Cutoff should be a Date');

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const formatted = formatter.format(cutoff);
    // 10/16/2026, 01:20
    assert(formatted.includes('01:20'), `Expected 01:20 IST but got ${formatted}`);
  });

  // -------------------------------------------------------------
  // 4. Session Duration and Cumulative Hours
  // -------------------------------------------------------------
  console.log('--- 4. Session Duration and Cumulative Hours ---');

  await test('Completed dual sessions sum to 6.0 hours without including gap', () => {
    const sessions = [
      {
        sessionIndex: 0,
        shiftWindow: '01:00 PM - 04:00 PM',
        checkIn: '2026-10-15T07:30:00.000Z', // 1:00 PM IST
        checkOut: '2026-10-15T10:30:00.000Z', // 4:00 PM IST
        durationHours: 3.0,
      },
      {
        sessionIndex: 1,
        shiftWindow: '10:00 PM - 01:00 AM',
        checkIn: '2026-10-15T16:30:00.000Z', // 10:00 PM IST
        checkOut: '2026-10-15T19:30:00.000Z', // 1:00 AM IST
        durationHours: 3.0,
      },
    ];

    const totalHours = sessions.reduce((acc, s) => acc + (s.durationHours || 0), 0);
    assert.strictEqual(totalHours, 6.0, `Expected total hours to be 6.0 but got ${totalHours}`);

    // If incorrectly calculated as first check-in to last check-out (13:00 to 01:00 next day = 12h)
    const naiveDuration = (new Date(sessions[1].checkOut).getTime() - new Date(sessions[0].checkIn).getTime()) / (1000 * 60 * 60);
    assert.strictEqual(naiveDuration, 12.0, 'Naive duration would have erroneously been 12 hours');
    assert.notStrictEqual(totalHours, naiveDuration, 'Total hours must exclude the off-duty break period');
  });

  console.log('\n================================================================');
  console.log(`Results: ${passedTests} Passed, ${failedTests} Failed`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
