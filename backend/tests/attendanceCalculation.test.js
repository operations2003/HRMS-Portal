import assert from 'assert';
import {
  parseTimeStr,
  parseShiftStartTime,
  parseShiftTiming,
  calculateWorkingHoursAndOvertime,
  calculateAutoLogoutCutoff,
} from '../src/services/attendanceService.js';

console.log('====================================================');
console.log('🧪 Running Attendance Calculation Test Suite');
console.log('====================================================\n');

let passedTests = 0;
let failedTests = 0;

function it(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

// -------------------------------------------------------------
// 1. Shift Time Parsing & AM/PM handling
// -------------------------------------------------------------
it('parseTimeStr: handles 12-hour AM/PM correctly', () => {
  assert.deepStrictEqual(parseTimeStr('12:00 AM'), { hour: 0, minute: 0 });
  assert.deepStrictEqual(parseTimeStr('12:30 AM'), { hour: 0, minute: 30 });
  assert.deepStrictEqual(parseTimeStr('01:00 AM'), { hour: 1, minute: 0 });
  assert.deepStrictEqual(parseTimeStr('1:21 PM'), { hour: 13, minute: 21 });
  assert.deepStrictEqual(parseTimeStr('11:34 PM'), { hour: 23, minute: 34 });
  assert.deepStrictEqual(parseTimeStr('12:00 PM'), { hour: 12, minute: 0 });
  assert.deepStrictEqual(parseTimeStr('12:45 PM'), { hour: 12, minute: 45 });
  assert.deepStrictEqual(parseTimeStr('07:00 PM'), { hour: 19, minute: 0 });
});

it('parseTimeStr: handles 24-hour time correctly', () => {
  assert.deepStrictEqual(parseTimeStr('00:15'), { hour: 0, minute: 15 });
  assert.deepStrictEqual(parseTimeStr('13:21'), { hour: 13, minute: 21 });
  assert.deepStrictEqual(parseTimeStr('23:34'), { hour: 23, minute: 34 });
});

// -------------------------------------------------------------
// 2. Shift Duration & Overnight Detection
// -------------------------------------------------------------
it('parseShiftTiming: parses 1:00 AM - 7:00 PM (18h shift) with various dashes', () => {
  const s1 = parseShiftTiming('01:00 AM - 07:00 PM');
  assert.strictEqual(s1.scheduledDurationHours, 18.0);
  assert.strictEqual(s1.isOvernight, false);

  const s2 = parseShiftTiming('1:00 AM–7:00 PM'); // en-dash
  assert.strictEqual(s2.scheduledDurationHours, 18.0);

  const s3 = parseShiftTiming('1:00 AM to 7:00 PM');
  assert.strictEqual(s3.scheduledDurationHours, 18.0);
});

it('parseShiftTiming: parses standard 11:00 AM - 07:00 PM (8h shift)', () => {
  const s = parseShiftTiming('11:00 AM - 07:00 PM');
  assert.strictEqual(s.startHour, 11);
  assert.strictEqual(s.endHour, 19);
  assert.strictEqual(s.scheduledDurationHours, 8.0);
  assert.strictEqual(s.isOvernight, false);
});

it('parseShiftTiming: handles overnight shifts crossing midnight', () => {
  const s1 = parseShiftTiming('06:08 PM - 07:00 AM');
  assert.strictEqual(s1.startHour, 18);
  assert.strictEqual(s1.startMinute, 8);
  assert.strictEqual(s1.endHour, 7);
  assert.strictEqual(s1.endMinute, 0);
  assert.strictEqual(s1.scheduledDurationHours, 12.87);
  assert.strictEqual(s1.isOvernight, true);

  const s2 = parseShiftTiming('09:00 PM - 05:00 AM');
  assert.strictEqual(s2.scheduledDurationHours, 8.0);
  assert.strictEqual(s2.isOvernight, true);
});

// -------------------------------------------------------------
// 3. User Example from Prompt
// -------------------------------------------------------------
it('calculateWorkingHoursAndOvertime: User Example (Shift 1:00 AM-7:00 PM, Login 1:21 PM, Logout 11:34 PM, Break 22m)', () => {
  const login = new Date('2026-09-22T13:21:00');
  const logout = new Date('2026-09-22T23:34:00');
  const result = calculateWorkingHoursAndOvertime({
    checkIn: login,
    checkOut: logout,
    breakDurationMinutes: 22,
    shiftTiming: '1:00 AM–7:00 PM',
  });

  assert.strictEqual(result.grossHours, 10.22);
  assert.strictEqual(result.breakDurationMinutes, 22);
  assert.strictEqual(result.totalHours, 9.85);
  // Assigned shift is 18.0 hours; 9.85 worked <= 18.0 -> 0.00 overtime
  assert.strictEqual(result.overtimeHours, 0.0);
  assert.strictEqual(result.scheduledDurationHours, 18.0);
});

// -------------------------------------------------------------
// 4. Overtime on Standard 8-Hour Shift
// -------------------------------------------------------------
it('calculateWorkingHoursAndOvertime: Standard 8h shift with overtime beyond 8.0h', () => {
  const login = new Date('2026-09-22T11:00:00');
  const logout = new Date('2026-09-22T21:30:00'); // 10.5h gross
  const result = calculateWorkingHoursAndOvertime({
    checkIn: login,
    checkOut: logout,
    breakDurationMinutes: 30, // 0.5h break -> 10.0h net
    shiftTiming: '11:00 AM - 07:00 PM', // 8.0h scheduled
  });

  assert.strictEqual(result.grossHours, 10.5);
  assert.strictEqual(result.breakDurationMinutes, 30);
  assert.strictEqual(result.totalHours, 10.0);
  assert.strictEqual(result.overtimeHours, 2.0);
  assert.strictEqual(result.scheduledDurationHours, 8.0);
});

// -------------------------------------------------------------
// 5. Overnight Shift Calculations
// -------------------------------------------------------------
it('calculateWorkingHoursAndOvertime: Overnight shift 09:00 PM - 05:00 AM with overtime', () => {
  const login = new Date('2026-09-22T21:00:00');
  const logout = new Date('2026-09-23T07:00:00'); // 10.0h gross
  const result = calculateWorkingHoursAndOvertime({
    checkIn: login,
    checkOut: logout,
    breakDurationMinutes: 45, // 0.75h break -> 9.25h net
    shiftTiming: '09:00 PM - 05:00 AM', // 8.0h scheduled
  });

  assert.strictEqual(result.grossHours, 10.0);
  assert.strictEqual(result.totalHours, 9.25);
  assert.strictEqual(result.overtimeHours, 1.25);
  assert.strictEqual(result.scheduledDurationHours, 8.0);
});

// -------------------------------------------------------------
// 6. Break History Array Summation
// -------------------------------------------------------------
it('calculateWorkingHoursAndOvertime: sums breakHistory array items correctly', () => {
  const login = new Date('2026-09-22T09:00:00');
  const logout = new Date('2026-09-22T18:00:00'); // 9.0h gross
  const breakHistory = [
    { durationSeconds: 900 },  // 15 mins
    { durationMinutes: 15 },   // 15 mins = 900 secs
  ];
  const result = calculateWorkingHoursAndOvertime({
    checkIn: login,
    checkOut: logout,
    breakHistory,
    shiftTiming: '09:00 AM - 05:00 PM',
  });

  assert.strictEqual(result.breakDurationMinutes, 30);
  assert.strictEqual(result.totalHours, 8.5);
  assert.strictEqual(result.overtimeHours, 0.5);
});

// -------------------------------------------------------------
// 7. Edge Cases & Safety Guards
// -------------------------------------------------------------
it('calculateWorkingHoursAndOvertime: guards against inverted timestamps', () => {
  const login = new Date('2026-09-22T18:00:00');
  const logout = new Date('2026-09-22T09:00:00');
  const result = calculateWorkingHoursAndOvertime({
    checkIn: login,
    checkOut: logout,
    shiftTiming: '11:00 AM - 07:00 PM',
  });

  assert.strictEqual(result.grossHours, 0.0);
  assert.strictEqual(result.totalHours, 0.0);
  assert.strictEqual(result.overtimeHours, 0.0);
});

console.log(`\n====================================================`);
console.log(`Test Results: ${passedTests} Passed, ${failedTests} Failed.`);
console.log(`====================================================\n`);

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
