import assert from 'assert';
import { enforceActiveWorkday } from '../src/middleware/workdayMiddleware.js';
import { pool } from '../src/config/db.js';

console.log('====================================================');
console.log('🧪 Running Workday Enforcement Middleware Test Suite');
console.log('====================================================\n');

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

// Mock Express req, res, next
function createMockReqRes({
  method = 'POST',
  url = '/api/v1/leaves',
  user = {
    id: 'user-1',
    employeeId: 'emp-1',
    roleName: 'Employee',
    timezone: 'Asia/Kolkata',
  },
} = {}) {
  const req = {
    method,
    originalUrl: url,
    path: url,
    user,
  };

  let statusCode = 200;
  let responseData = null;
  let nextCalled = false;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
  };

  const next = () => {
    nextCalled = true;
  };

  return {
    req,
    res,
    next,
    getStatus: () => statusCode,
    getResponse: () => responseData,
    isNextCalled: () => nextCalled,
  };
}

async function runTests() {
  const origQuery = pool.query;

  // --- 1. Admin Role Exemption ---
  console.log('--- 1. Admin Role Exemption ---');

  await test('Admin role is exempt and can make changes anytime', async () => {
    const { req, res, next, isNextCalled } = createMockReqRes({
      user: { id: 'admin-1', employeeId: 'emp-admin', roleName: 'Admin' },
    });
    await enforceActiveWorkday(req, res, next);
    assert.strictEqual(isNextCalled(), true);
  });

  await test('SuperAdmin and OrgAdmin roles are exempt', async () => {
    const { req, res, next, isNextCalled } = createMockReqRes({
      user: { id: 'sa-1', employeeId: 'emp-sa', roleName: 'SuperAdmin' },
    });
    await enforceActiveWorkday(req, res, next);
    assert.strictEqual(isNextCalled(), true);
  });

  // --- 2. HTTP Method Exemptions (Read-Only) ---
  console.log('\n--- 2. Read-Only Method Exemptions (GET, HEAD, OPTIONS) ---');

  await test('GET requests are exempt (users can view/read even if logged out)', async () => {
    const { req, res, next, isNextCalled } = createMockReqRes({
      method: 'GET',
      user: { id: 'emp-1', employeeId: 'emp-1', roleName: 'Employee' },
    });
    await enforceActiveWorkday(req, res, next);
    assert.strictEqual(isNextCalled(), true);
  });

  // --- 3. Path Exemptions (Attendance Punches & Auth) ---
  console.log('\n--- 3. Path Exemptions (Check-In, Check-Out, Break, Auth) ---');

  await test('POST /attendance/check-in is exempt (allows punching in)', async () => {
    const { req, res, next, isNextCalled } = createMockReqRes({
      method: 'POST',
      url: '/api/v1/attendance/check-in',
      user: { id: 'emp-1', employeeId: 'emp-1', roleName: 'Employee' },
    });
    await enforceActiveWorkday(req, res, next);
    assert.strictEqual(isNextCalled(), true);
  });

  await test('POST /attendance/check-out is exempt (allows punching out)', async () => {
    const { req, res, next, isNextCalled } = createMockReqRes({
      method: 'POST',
      url: '/api/v1/attendance/check-out',
      user: { id: 'emp-1', employeeId: 'emp-1', roleName: 'Employee' },
    });
    await enforceActiveWorkday(req, res, next);
    assert.strictEqual(isNextCalled(), true);
  });

  await test('POST /attendance/pause-break and resume-break are exempt', async () => {
    const { req, res, next, isNextCalled } = createMockReqRes({
      method: 'POST',
      url: '/api/v1/attendance/pause-break',
      user: { id: 'emp-1', employeeId: 'emp-1', roleName: 'Employee' },
    });
    await enforceActiveWorkday(req, res, next);
    assert.strictEqual(isNextCalled(), true);
  });

  await test('POST /auth/logout is exempt', async () => {
    const { req, res, next, isNextCalled } = createMockReqRes({
      method: 'POST',
      url: '/api/v1/auth/logout',
      user: { id: 'emp-1', employeeId: 'emp-1', roleName: 'Employee' },
    });
    await enforceActiveWorkday(req, res, next);
    assert.strictEqual(isNextCalled(), true);
  });

  await test('POST /daily-reports is exempt (allows submitting daily work report even when logged out)', async () => {
    const { req, res, next, isNextCalled } = createMockReqRes({
      method: 'POST',
      url: '/api/v1/daily-reports',
      user: { id: 'emp-1', employeeId: 'emp-1', roleName: 'Employee' },
    });
    await enforceActiveWorkday(req, res, next);
    assert.strictEqual(isNextCalled(), true);
  });

  // --- 4. Workday Status Enforcement for HR / Manager / Employee ---
  console.log('\n--- 4. Workday Status Enforcement for HR, Manager, Employee ---');

  await test('When Employee is logged out for the day (check_out set): REJECTS with 403', async () => {
    pool.query = async (sql, params) => {
      return {
        rows: [
          {
            id: 'att-1',
            check_in: new Date('2026-10-08T09:00:00Z'),
            check_out: new Date('2026-10-08T17:00:00Z'), // checked out!
            attendance_date: '2026-10-08',
          },
        ],
      };
    };

    const { req, res, next, isNextCalled, getStatus, getResponse } = createMockReqRes({
      method: 'POST',
      url: '/api/v1/leaves',
      user: { id: 'emp-1', employeeId: 'emp-1', roleName: 'Employee' },
    });

    await enforceActiveWorkday(req, res, next);

    assert.strictEqual(isNextCalled(), false, 'next() should not be called');
    assert.strictEqual(getStatus(), 403, 'Should return HTTP 403 Forbidden');
    const resp = getResponse();
    assert(resp.message.includes('logged out for the day'), 'Should mention logged out for the day');
  });

  await test('When HR is logged out for the day (check_out set): REJECTS with 403', async () => {
    pool.query = async (sql, params) => {
      return {
        rows: [
          {
            id: 'att-hr-1',
            check_in: new Date('2026-10-08T09:00:00Z'),
            check_out: new Date('2026-10-08T18:00:00Z'),
            attendance_date: '2026-10-08',
          },
        ],
      };
    };

    const { req, res, next, isNextCalled, getStatus, getResponse } = createMockReqRes({
      method: 'PUT',
      url: '/api/v1/employees/emp-2',
      user: { id: 'hr-1', employeeId: 'emp-hr', roleName: 'HR' },
    });

    await enforceActiveWorkday(req, res, next);

    assert.strictEqual(isNextCalled(), false);
    assert.strictEqual(getStatus(), 403);
    assert(getResponse().message.includes('logged out for the day'));
  });

  await test('When Manager is logged out for the day (check_out set): REJECTS with 403', async () => {
    pool.query = async (sql, params) => {
      return {
        rows: [
          {
            id: 'att-mgr-1',
            check_in: new Date('2026-10-08T09:00:00Z'),
            check_out: new Date('2026-10-08T17:30:00Z'),
            attendance_date: '2026-10-08',
          },
        ],
      };
    };

    const { req, res, next, isNextCalled, getStatus } = createMockReqRes({
      method: 'POST',
      url: '/api/v1/manager/leaves/123/approve',
      user: { id: 'mgr-1', employeeId: 'emp-mgr', roleName: 'Manager' },
    });

    await enforceActiveWorkday(req, res, next);

    assert.strictEqual(isNextCalled(), false);
    assert.strictEqual(getStatus(), 403);
  });

  await test('When Employee has NOT logged in for the day (!check_in): REJECTS with 403', async () => {
    pool.query = async (sql, params) => {
      return { rows: [] }; // No attendance record today
    };

    const { req, res, next, isNextCalled, getStatus, getResponse } = createMockReqRes({
      method: 'POST',
      url: '/api/v1/expenses',
      user: { id: 'emp-1', employeeId: 'emp-1', roleName: 'Employee' },
    });

    await enforceActiveWorkday(req, res, next);

    assert.strictEqual(isNextCalled(), false);
    assert.strictEqual(getStatus(), 403);
    assert(getResponse().message.includes('must be logged in for your workday'));
  });

  await test('When Employee is actively logged in (check_in present, check_out null): ALLOWS changes', async () => {
    pool.query = async (sql, params) => {
      return {
        rows: [
          {
            id: 'att-active-1',
            check_in: new Date('2026-10-08T09:30:00Z'),
            check_out: null, // actively working!
            attendance_date: '2026-10-08',
          },
        ],
      };
    };

    const { req, res, next, isNextCalled } = createMockReqRes({
      method: 'POST',
      url: '/api/v1/tasks',
      user: { id: 'emp-1', employeeId: 'emp-1', roleName: 'Employee' },
    });

    await enforceActiveWorkday(req, res, next);

    assert.strictEqual(isNextCalled(), true, 'Actively logged in employee must be allowed to make changes');
  });

  // Restore pool.query
  pool.query = origQuery;

  console.log('\n====================================================');
  console.log(`Test Results: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();

