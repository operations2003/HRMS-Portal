import assert from 'assert';
import aiRosterService from '../src/services/aiRosterService.js';

console.log('====================================================');
console.log('🧪 Running AI Roster Automation Tests');
console.log('====================================================');

// --- 1. Custom & Non-Standard Shift Interpretation ---
console.log('\n--- 1. Custom & Non-Standard Shift Interpretation ---');

const testShifts = [
  { input: 'M', expectedType: 'SHIFT', expectedLabel: 'Morning Shift (07:00 - 16:00)', start: '07:00:00' },
  { input: 'MORNING', expectedType: 'SHIFT', expectedLabel: 'Morning Shift (07:00 - 16:00)', start: '07:00:00' },
  { input: 'E', expectedType: 'SHIFT', expectedLabel: 'Evening Shift (14:00 - 22:00)', start: '14:00:00' },
  { input: 'N', expectedType: 'SHIFT', expectedLabel: 'Night Shift (22:00 - 06:00)', start: '22:00:00' },
  { input: 'G', expectedType: 'SHIFT', expectedLabel: 'General Shift (09:30 - 18:30)', start: '09:30:00' },
  { input: 'WFH', expectedType: 'SHIFT', expectedLabel: 'Work From Home (09:00 - 18:00)', start: '09:00:00' },
  { input: 'WO', expectedType: 'WO', expectedLabel: 'Weekly Off' },
  { input: 'OFF', expectedType: 'WO', expectedLabel: 'Weekly Off' },
  { input: 'HD', expectedType: 'HD', expectedLabel: 'Holiday' },
  { input: 'CL', expectedType: 'CL', expectedLabel: 'Casual Leave' },
  { input: 'NA', expectedType: 'NA', expectedLabel: 'Not Assigned' },
];

for (const tc of testShifts) {
  const res = aiRosterService.normalizeShiftWithAI(tc.input);
  assert.strictEqual(res.shiftType, tc.expectedType, `Failed on ${tc.input}: expected type ${tc.expectedType}`);
  assert.strictEqual(res.shiftLabel, tc.expectedLabel, `Failed on ${tc.input}: expected label ${tc.expectedLabel}`);
  if (tc.start) {
    assert.strictEqual(res.shiftStartTime, tc.start, `Failed on ${tc.input}: expected start time ${tc.start}`);
  }
  console.log(`  ✅ PASS: "${tc.input}" normalized to ${res.shiftType} (${res.shiftLabel})`);
}

// --- 2. Arbitrary Spreadsheet Matrix Layout Parsing ---
console.log('\n--- 2. Arbitrary Spreadsheet Matrix Layout Parsing ---');

const arbitraryMatrix = [
  ['Company Roster October 2026', '', '', '', ''],
  ['Department: Engineering', '', '', '', ''],
  ['Staff Member', 'Role', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31'],
  ['Aarav Sharma', 'Frontend Dev', 'M', 'M', 'M', 'M', 'M', 'WO', 'WO', 'E', 'E', 'E', 'E', 'E', 'WO', 'WO', 'WFH', 'WFH', 'WFH', 'WFH', 'WFH', 'WO', 'WO', 'G', 'G', 'G', 'G', 'G', 'WO', 'WO', 'M', 'M'],
  ['Priya Patel', 'Backend Dev', 'G', 'G', 'G', 'G', 'G', 'WO', 'WO', 'N', 'N', 'N', 'N', 'N', 'WO', 'WO', 'WFH', 'WFH', 'WFH', 'WFH', 'WFH', 'WO', 'WO', 'M', 'M', 'M', 'M', 'M', 'WO', 'WO', 'G', 'G']
];

const parsed = await aiRosterService.parseArbitraryRoster(
  arbitraryMatrix,
  10,
  2026,
  'custom_october_roster.xlsx'
);

assert.strictEqual(parsed.employees.length, 2, 'Should detect 2 employees');
assert.strictEqual(parsed.dayColumns.length, 31, 'October has 31 days');
assert.strictEqual(parsed.employees[0].rosterEmployeeName, 'Aarav Sharma');
assert.strictEqual(parsed.employees[0].rosterDesignation, 'Frontend Dev');
assert.strictEqual(parsed.employees[0].dailyAssignments[0].shiftLabel, 'Morning Shift (07:00 - 16:00)');
assert.strictEqual(parsed.employees[0].dailyAssignments[5].shiftType, 'WO');
console.log(`  ✅ PASS: Arbitrary layout detected and parsed ${parsed.employees.length} employees with ${parsed.dayColumns.length} days.`);

// --- 3. AI Ambiguity Auto-Resolution Engine ---
console.log('\n--- 3. AI Ambiguity Auto-Resolution Engine ---');

const ambiguousMappings = [
  {
    id: 'map-1',
    rosterEmployeeName: 'Aarav S.',
    rosterDesignation: 'Frontend Engineer',
    alternativeMatches: [
      { employeeId: 'emp-101', employeeName: 'Aarav Sharma', designation: 'Frontend Engineer', confidence: 0.88 },
      { employeeId: 'emp-102', employeeName: 'Aarav Singh', designation: 'QA Engineer', confidence: 0.65 }
    ]
  },
  {
    id: 'map-2',
    rosterEmployeeName: 'Priya P',
    rosterDesignation: 'Backend Developer',
    alternativeMatches: [
      { employeeId: 'emp-201', employeeName: 'Priya Patel', designation: 'Backend Developer', confidence: 0.91 }
    ]
  }
];

const orgEmployees = [
  { id: 'emp-101', first_name: 'Aarav', last_name: 'Sharma', designation: 'Frontend Engineer', employee_code: 'EMP001' },
  { id: 'emp-102', first_name: 'Aarav', last_name: 'Singh', designation: 'QA Engineer', employee_code: 'EMP002' },
  { id: 'emp-201', first_name: 'Priya', last_name: 'Patel', designation: 'Backend Developer', employee_code: 'EMP003' }
];

const autoResolveResult = await aiRosterService.autoResolveAmbiguities(ambiguousMappings, orgEmployees);

assert.strictEqual(autoResolveResult.resolvedMappings.length, 2, 'Both mappings should be resolved');
assert.strictEqual(autoResolveResult.resolvedMappings[0].matchedEmployeeId, 'emp-101');
assert.strictEqual(autoResolveResult.resolvedMappings[1].matchedEmployeeId, 'emp-201');
console.log(`  ✅ PASS: Disambiguated 'Aarav S.' -> emp-101 (${autoResolveResult.resolvedMappings[0].confidence}% confidence)`);
console.log(`  ✅ PASS: Disambiguated 'Priya P' -> emp-201 (${autoResolveResult.resolvedMappings[1].confidence}% confidence)`);

console.log('\n====================================================');
console.log('All AI Roster Automation Tests Passed Successfully! 🎉');
console.log('====================================================\n');
