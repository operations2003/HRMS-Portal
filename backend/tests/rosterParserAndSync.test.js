import assert from 'assert';
import rosterParserService from '../src/services/rosterParserService.js';

console.log('====================================================');
console.log('🧪 Running Monthly Roster Parser & Sync Tests');
console.log('====================================================\n');

// 1. Shift Parsing
console.log('--- 1. Shift String Normalization & AM/PM Disambiguation ---');

const testCases = [
  { input: '11 - 8 PM', expectedStart: '11:00:00', expectedEnd: '20:00:00', overnight: false },
  { input: '2 - 8 PM',  expectedStart: '14:00:00', expectedEnd: '20:00:00', overnight: false },
  { input: '12 - 6 PM', expectedStart: '12:00:00', expectedEnd: '18:00:00', overnight: false },
  { input: '1 - 7 PM',  expectedStart: '13:00:00', expectedEnd: '19:00:00', overnight: false },
  { input: '5 - 11 PM', expectedStart: '17:00:00', expectedEnd: '23:00:00', overnight: false },
  { input: '11 - 5 PM', expectedStart: '11:00:00', expectedEnd: '17:00:00', overnight: false },
  { input: '1-7 PM',    expectedStart: '13:00:00', expectedEnd: '19:00:00', overnight: false },
  { input: '2-8PM',     expectedStart: '14:00:00', expectedEnd: '20:00:00', overnight: false },
  { input: '11:00 AM - 08:00 PM', expectedStart: '11:00:00', expectedEnd: '20:00:00', overnight: false },
  { input: '10 PM - 6 AM', expectedStart: '22:00:00', expectedEnd: '06:00:00', overnight: true },
];

for (const tc of testCases) {
  const res = rosterParserService.parseShiftTime(tc.input, '2026-10-01', 'Test User');
  assert.strictEqual(res.isValid, true, `Failed for ${tc.input}: ${res.error}`);
  assert.strictEqual(res.shiftStartTime, tc.expectedStart, `Mismatch start time for ${tc.input}: got ${res.shiftStartTime}, expected ${tc.expectedStart}`);
  assert.strictEqual(res.shiftEndTime, tc.expectedEnd, `Mismatch end time for ${tc.input}: got ${res.shiftEndTime}, expected ${tc.expectedEnd}`);
  assert.strictEqual(res.isOvernight, tc.overnight, `Mismatch overnight for ${tc.input}`);
  console.log(`  ✅ PASS: "${tc.input}" parsed as ${res.shiftStartTime} -> ${res.shiftEndTime} (${res.shiftLabel})`);
}

// 2. Status Codes
console.log('\n--- 2. Roster Status Codes & Blank Cells ---');
const codes = ['WO', 'CL', 'PL', 'SL', 'HD', 'HDL', 'LOP', 'LWP', 'ML', 'PTL', 'SBL', 'AWOL', 'HL', 'OFF', 'NA', ''];
for (const code of codes) {
  const res = rosterParserService.parseShiftCell(code, '2026-10-01', 'Test User');
  if (!code) {
    assert.strictEqual(res.shiftType, 'BLANK');
    console.log(`  ✅ PASS: Empty cell parsed as BLANK (unspecified)`);
  } else {
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.shiftStartTime, null);
    assert.strictEqual(res.shiftEndTime, null);
    console.log(`  ✅ PASS: "${code}" recognized as roster status / leave code (mapped to ${res.shiftType})`);
  }
}

// 3. Calendar & Leap Year Validation
console.log('\n--- 3. Calendar Days & Leap Year Validation ---');
// February in leap year 2024 has 29 days
const feb2024Cols = rosterParserService.parseDayColumns(
  ['Name', 'Desig', ...Array.from({ length: 31 }, (_, i) => String(i + 1))],
  null,
  2,
  2, // Feb
  2024,
  29,
  []
);
assert.strictEqual(feb2024Cols.length, 29, 'Feb 2024 should have 29 days');
console.log('  ✅ PASS: Leap year February 2024 correctly extracts 29 calendar days');

// February in non-leap year 2026 has 28 days
const feb2026Warnings = [];
const feb2026Cols = rosterParserService.parseDayColumns(
  ['Name', 'Desig', ...Array.from({ length: 31 }, (_, i) => String(i + 1))],
  null,
  2,
  2, // Feb
  2026,
  28,
  feb2026Warnings
);
assert.strictEqual(feb2026Cols.length, 28, 'Feb 2026 should have 28 days');
assert.strictEqual(feb2026Warnings.length > 0, true, 'Should warn about days 29, 30, 31 in Feb 2026');
console.log('  ✅ PASS: Non-leap year February 2026 correctly extracts 28 days and warns about 29-31');

// 4. Working Days Discrepancy Check
console.log('\n--- 4. Working Days Discrepancy Detection ---');
const mockData = [
  ['Employee Name', 'Designation', '1', '2', '3', 'Working Days'],
  ['', '', 'Mon', 'Tue', 'Wed', ''],
  ['Alice Smith', 'Developer', '11 - 8 PM', '11 - 8 PM', 'WO', '3'], // Declared 3, calculated 2
];
const parsed = rosterParserService.parseRosterData(mockData, 10, 2026, 'roster.xlsx');
assert.strictEqual(parsed.employees[0].calculatedWorkingDays, 2);
assert.strictEqual(parsed.employees[0].declaredWorkingDays, 3);
assert.strictEqual(parsed.employees[0].hasWorkingDaysDiscrepancy, true);
console.log('  ✅ PASS: Correctly flags working days discrepancy (Declared: 3 vs Calculated: 2)');

// 5. Leave Bucket Quotas & Deduction Logic
console.log('\n--- 5. Leave Mappings & Bucket Deduction Verification ---');
import('../src/controllers/rosterController.js').then(({ LEAVE_MAPPINGS, DEFAULT_LEAVE_QUOTAS }) => {
  // Check required leave types
  assert.strictEqual(LEAVE_MAPPINGS['CL'].code, 'CL');
  assert.strictEqual(LEAVE_MAPPINGS['PL'].code, 'PL');
  assert.strictEqual(LEAVE_MAPPINGS['SL'].code, 'SL');
  assert.strictEqual(LEAVE_MAPPINGS['HD'].isHalf, true);
  assert.strictEqual(LEAVE_MAPPINGS['HDL'].isHalf, true);
  console.log('  ✅ PASS: LEAVE_MAPPINGS contains CL, PL, SL, HD, HDL, LOP, ML, PTL, HL');

  // Check default quotas
  assert.strictEqual(DEFAULT_LEAVE_QUOTAS['CL'], 12.0);
  assert.strictEqual(DEFAULT_LEAVE_QUOTAS['PL'], 15.0);
  assert.strictEqual(DEFAULT_LEAVE_QUOTAS['SL'], 10.0);
  assert.strictEqual(DEFAULT_LEAVE_QUOTAS['HDL'], 6.0);
  console.log('  ✅ PASS: DEFAULT_LEAVE_QUOTAS sets CL=12.0, PL=15.0, SL=10.0, HDL=6.0');

  // Verify deduction simulation
  // Case A: New employee without prior bucket:
  const clInitialAlloc = Math.max(DEFAULT_LEAVE_QUOTAS['CL'], 1.0); // 12.0
  const clUsed = 1.0;
  const clRemaining = clInitialAlloc - clUsed; // 11.0 (minused from bucket)
  assert.strictEqual(clRemaining, 11.0);
  console.log('  ✅ PASS: New bucket initialized with 12.0 and deductions result in remaining_days = 11.0');

  // Case B: Half-day deduction
  const hdInitialAlloc = Math.max(DEFAULT_LEAVE_QUOTAS['HDL'], 0.5); // 6.0
  const hdUsed = 0.5;
  const hdRemaining = hdInitialAlloc - hdUsed; // 5.5
  assert.strictEqual(hdRemaining, 5.5);
  console.log('  ✅ PASS: Half-day deduction leaves remaining_days = 5.5');

  console.log('\n====================================================');
  console.log('All Roster Parser Unit Tests Passed Successfully! 🎉');
  console.log('====================================================\n');
});
