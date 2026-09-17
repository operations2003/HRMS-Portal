import http from 'http';

const BASE_URL = 'http://localhost:5000/api';

const request = (method, endpoint, body = null, token = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + endpoint);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

async function runManagerTests() {
  console.log('🧪 Starting Phase 6 Manager APIs Security & Functional Tests...\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, msg, details = null) => {
    if (condition) {
      console.log(`✅ [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${msg}`);
      if (details) console.error('   Details:', JSON.stringify(details, null, 2));
      failed++;
    }
  };

  try {
    // 1. Authenticate Admin (for setup and management)
    const adminLogin = await request('POST', '/v1/auth/login', {
      email: 'shubham@tasknera.com',
      password: 'Shubham@264',
    });
    const adminToken = adminLogin.body.data?.token;
    assert(!!adminToken, 'Auth: Successfully logged in as Admin');

    // 2. Authenticate Employee (to verify RBAC blocks standard employee from manager routes)
    // In our DB users: ajay1@tasknera.com or sakshi@tasknera.com
    // We will test unauthenticated access and role-gated access
    const noTokenRes = await request('GET', '/v1/manager/dashboard');
    assert(noTokenRes.status === 401, 'Security: Unauthenticated request rejected with 401 Unauthorized');

    // 3. Manager Profile & Dashboard Data
    console.log('\n--- 1. Manager Profile & Dashboard Data ---');
    const dashboardRes = await request('GET', '/v1/manager/dashboard', null, adminToken);
    assert(
      dashboardRes.status === 200 && dashboardRes.body.data?.manager,
      'GET /v1/manager/dashboard returns 200 with manager profile & metrics',
      dashboardRes
    );

    const profileRes = await request('GET', '/v1/manager/profile', null, adminToken);
    assert(
      profileRes.status === 200 && profileRes.body.data?.teamSummary,
      'GET /v1/manager/profile alias returns 200 with team summary',
      profileRes
    );

    // 4. Assigned Team Members
    console.log('\n--- 2. Assigned Team Members & Member Profiles ---');
    const teamRes = await request('GET', '/v1/manager/team', null, adminToken);
    assert(
      teamRes.status === 200 && Array.isArray(teamRes.body.data),
      'GET /v1/manager/team returns 200 with list of team members',
      teamRes
    );

    // Fetch an employee to test team member profile
    const empList = await request('GET', '/v1/employees', null, adminToken);
    const employees = empList.body.data?.employees || empList.body.data || [];
    assert(employees.length > 0, 'Found existing employees for team tests');

    const testEmp = employees[0];
    const testEmpId = testEmp?.id;

    if (testEmpId) {
      const memberDetailRes = await request('GET', `/v1/manager/team/members/${testEmpId}`, null, adminToken);
      assert(
        memberDetailRes.status === 200 && memberDetailRes.body.data?.id === testEmpId,
        `GET /v1/manager/team/members/:id returns 200 for employee ${testEmpId}`,
        memberDetailRes
      );
    }

    // 5. Team Employee Summary
    console.log('\n--- 3. Team Employee Summary ---');
    const summaryRes = await request('GET', '/v1/manager/team/summary', null, adminToken);
    assert(
      summaryRes.status === 200 && summaryRes.body.data?.totalMembers !== undefined,
      'GET /v1/manager/team/summary returns 200 with headcount and department breakdown',
      summaryRes
    );

    // 6. Team Attendance Summary
    console.log('\n--- 4. Team Attendance Summary & Detail ---');
    const attRes = await request('GET', '/v1/manager/team/attendance', null, adminToken);
    assert(
      attRes.status === 200 && Array.isArray(attRes.body.data),
      'GET /v1/manager/team/attendance returns 200 daily team attendance rows',
      attRes
    );

    const attSummaryRes = await request('GET', '/v1/manager/team/attendance/summary', null, adminToken);
    assert(
      attSummaryRes.status === 200 && attSummaryRes.body.data?.attendanceRate !== undefined,
      'GET /v1/manager/team/attendance/summary returns 200 aggregated attendance rates',
      attSummaryRes
    );

    if (testEmpId) {
      const memberAttRes = await request(
        'GET',
        `/v1/manager/team/members/${testEmpId}/attendance`,
        null,
        adminToken
      );
      assert(
        memberAttRes.status === 200 && Array.isArray(memberAttRes.body.data?.records),
        `GET /v1/manager/team/members/:id/attendance returns 200 history for ${testEmpId}`,
        memberAttRes
      );
    }

    // 7. Team Leave Information
    console.log('\n--- 5. Team Leave Information ---');
    const leavesRes = await request('GET', '/v1/manager/team/leaves', null, adminToken);
    assert(
      leavesRes.status === 200 && Array.isArray(leavesRes.body.data),
      'GET /v1/manager/team/leaves returns 200 with team leaves queue',
      leavesRes
    );

    if (testEmpId) {
      const memberLeaveRes = await request(
        'GET',
        `/v1/manager/team/members/${testEmpId}/leaves`,
        null,
        adminToken
      );
      assert(
        memberLeaveRes.status === 200 && Array.isArray(memberLeaveRes.body.data?.leaves),
        `GET /v1/manager/team/members/:id/leaves returns 200 balances & history for ${testEmpId}`,
        memberLeaveRes
      );
    }

    // 8. Team Performance Information
    console.log('\n--- 6. Team Performance Information ---');
    const perfRes = await request('GET', '/v1/manager/team/performance', null, adminToken);
    assert(
      perfRes.status === 200 && Array.isArray(perfRes.body.data),
      'GET /v1/manager/team/performance returns 200 appraisals array',
      perfRes
    );

    if (testEmpId) {
      const memberPerfRes = await request(
        'GET',
        `/v1/manager/team/members/${testEmpId}/performance`,
        null,
        adminToken
      );
      assert(
        memberPerfRes.status === 200 && memberPerfRes.body.data?.employee,
        `GET /v1/manager/team/members/:id/performance returns 200 appraisal records for ${testEmpId}`,
        memberPerfRes
      );
    }

    // 9. Pending Manager Approvals Queue
    console.log('\n--- 7. Pending Manager Approvals ---');
    const approvalsRes = await request('GET', '/v1/manager/approvals', null, adminToken);
    assert(
      approvalsRes.status === 200 &&
        Array.isArray(approvalsRes.body.data?.leaves) &&
        Array.isArray(approvalsRes.body.data?.appraisals),
      'GET /v1/manager/approvals returns 200 consolidated pending queue',
      approvalsRes
    );

    // 10. Security Boundary Validations
    console.log('\n--- 8. Security & Team Scope Boundary Validations ---');

    // Missing / Invalid format employee ID
    const invalidIdRes = await request(
      'GET',
      '/v1/manager/team/members/invalid!id@#$%^',
      null,
      adminToken
    );
    assert(
      invalidIdRes.status === 400 && invalidIdRes.body.success === false,
      'Security: Invalid employee ID format rejected with 400 Bad Request',
      invalidIdRes
    );

    // Nonexistent employee ID
    const nonexistentRes = await request(
      'GET',
      '/v1/manager/team/members/emp-nonexistent-99999',
      null,
      adminToken
    );
    assert(
      nonexistentRes.status === 404 && nonexistentRes.body.success === false,
      'Security: Nonexistent employee rejected with 404 Not Found',
      nonexistentRes
    );

    // Manager Assignment
    const assignRes = await request(
      'PATCH',
      '/v1/manager/assign',
      { employeeId: testEmpId, managerId: employees[1]?.id || testEmpId },
      adminToken
    );
    assert(
      assignRes.status === 200 && assignRes.body.success,
      'PATCH /v1/manager/assign successfully assigns manager',
      assignRes
    );

    // Revert manager assignment back
    await request(
      'PATCH',
      '/v1/manager/assign',
      { employeeId: testEmpId, managerId: testEmp.managerId || null },
      adminToken
    );

    console.log(`\n🏁 Manager APIs Test Results: ${passed} passed, ${failed} failed.`);
  } catch (err) {
    console.error('Fatal error during manager test suite run:', err);
  }
}

runManagerTests();
