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

async function runTeamTests() {
  console.log('🧪 Starting Phase 6 Team Management APIs Tests...\n');

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
    // 1. Auth Admin
    const adminLogin = await request('POST', '/v1/auth/login', {
      email: 'shubham@tasknera.com',
      password: 'Shubham@264',
    });
    const token = adminLogin.body.data?.token;
    assert(!!token, 'Auth: Successfully authenticated Admin token');

    // 2. Unauthenticated check
    const unauth = await request('GET', '/v1/team');
    assert(unauth.status === 401, 'Security: Unauthenticated request rejected with 401');

    // 3. View Team Members & Manager's Team
    console.log('\n--- 1. View Team Members & Manager Team ---');
    const teamMembersRes = await request('GET', '/v1/team', null, token);
    assert(
      teamMembersRes.status === 200 && Array.isArray(teamMembersRes.body.data),
      'GET /v1/team returns 200 with team members list',
      teamMembersRes
    );

    // Fetch existing employees
    const empList = await request('GET', '/v1/employees', null, token);
    const employees = empList.body.data?.employees || empList.body.data || [];
    assert(employees.length >= 2, 'Found existing employees for team hierarchy');

    const empA = employees[0];
    const empB = employees[1];

    // 4. Team Summary
    console.log('\n--- 2. Team Summary ---');
    const summaryRes = await request('GET', '/v1/team/summary', null, token);
    assert(
      summaryRes.status === 200 && summaryRes.body.data?.totalMembers !== undefined,
      'GET /v1/team/summary returns 200 with totalMembers and presence metrics',
      summaryRes
    );

    // 5. Team Employee Details Where Authorized
    console.log('\n--- 3. Team Employee Details Where Authorized ---');
    const detailsRes = await request('GET', `/v1/team/members/${empA.id}`, null, token);
    assert(
      detailsRes.status === 200 && detailsRes.body.data?.id === empA.id,
      `GET /v1/team/members/:id returns 200 for employee ${empA.id}`,
      detailsRes
    );

    // 6. Team Attendance Summary
    console.log('\n--- 4. Team Attendance Summary & Detail ---');
    const attListRes = await request('GET', '/v1/team/attendance', null, token);
    assert(
      attListRes.status === 200 && Array.isArray(attListRes.body.data),
      'GET /v1/team/attendance returns 200 daily attendance rows',
      attListRes
    );

    const attSummaryRes = await request('GET', '/v1/team/attendance/summary', null, token);
    assert(
      attSummaryRes.status === 200 && attSummaryRes.body.data?.attendanceRate !== undefined,
      'GET /v1/team/attendance/summary returns 200 aggregated attendance rates',
      attSummaryRes
    );

    const memberAttRes = await request('GET', `/v1/team/members/${empA.id}/attendance`, null, token);
    assert(
      memberAttRes.status === 200 && Array.isArray(memberAttRes.body.data?.records),
      `GET /v1/team/members/:id/attendance returns 200 for ${empA.id}`,
      memberAttRes
    );

    // 7. Team Leave Summary
    console.log('\n--- 5. Team Leave Summary & Detail ---');
    const leavesListRes = await request('GET', '/v1/team/leaves', null, token);
    assert(
      leavesListRes.status === 200 && Array.isArray(leavesListRes.body.data),
      'GET /v1/team/leaves returns 200 with team leaves',
      leavesListRes
    );

    const leaveSummaryRes = await request('GET', '/v1/team/leaves/summary', null, token);
    assert(
      leaveSummaryRes.status === 200 && leaveSummaryRes.body.data?.pendingLeaves !== undefined,
      'GET /v1/team/leaves/summary returns 200 with pending and on-leave counts',
      leaveSummaryRes
    );

    const memberLeavesRes = await request('GET', `/v1/team/members/${empA.id}/leaves`, null, token);
    assert(
      memberLeavesRes.status === 200 && Array.isArray(memberLeavesRes.body.data?.leaves),
      `GET /v1/team/members/:id/leaves returns 200 for ${empA.id}`,
      memberLeavesRes
    );

    // 8. Team Performance Summary
    console.log('\n--- 6. Team Performance Summary & Detail ---');
    const perfListRes = await request('GET', '/v1/team/performance', null, token);
    assert(
      perfListRes.status === 200 && Array.isArray(perfListRes.body.data),
      'GET /v1/team/performance returns 200 appraisal records array',
      perfListRes
    );

    const perfSummaryRes = await request('GET', '/v1/team/performance/summary', null, token);
    assert(
      perfSummaryRes.status === 200 && perfSummaryRes.body.data?.totalAppraisals !== undefined,
      'GET /v1/team/performance/summary returns 200 appraisal status counters',
      perfSummaryRes
    );

    const memberPerfRes = await request('GET', `/v1/team/members/${empA.id}/performance`, null, token);
    assert(
      memberPerfRes.status === 200 && Array.isArray(memberPerfRes.body.data?.records),
      `GET /v1/team/members/:id/performance returns 200 records for ${empA.id}`,
      memberPerfRes
    );

    // 9. Team Assignment & Hierarchy Management
    console.log('\n--- 7. Team Assignment & Hierarchy Management ---');
    const assignRes = await request(
      'PATCH',
      '/v1/team/assign',
      { employeeId: empA.id, managerId: empB.id },
      token
    );
    assert(
      assignRes.status === 200 && assignRes.body.success,
      `PATCH /v1/team/assign successfully assigned manager ${empB.id} to ${empA.id}`,
      assignRes
    );

    // 10. Security & Manipulation Prevention
    console.log('\n--- 8. Security & Scope Protection ---');

    // Self-assignment prevention
    const selfAssignRes = await request(
      'PATCH',
      '/v1/team/assign',
      { employeeId: empA.id, managerId: empA.id },
      token
    );
    assert(
      selfAssignRes.status === 400 && selfAssignRes.body.success === false,
      'Security: Self-manager assignment rejected with 400 Bad Request',
      selfAssignRes
    );

    // Circular hierarchy prevention (Now B tries to report to A, while A reports to B)
    const cycleRes = await request(
      'PATCH',
      '/v1/team/assign',
      { employeeId: empB.id, managerId: empA.id },
      token
    );
    assert(
      cycleRes.status === 400 && cycleRes.body.success === false,
      'Security: Circular hierarchy loop rejected with 400 Bad Request',
      cycleRes
    );

    // Invalid employee ID format
    const invalidIdRes = await request(
      'GET',
      '/v1/team/members/invalid!id@#$%^',
      null,
      token
    );
    assert(
      invalidIdRes.status === 400 && invalidIdRes.body.success === false,
      'Security: Employee ID manipulation rejected with 400 Bad Request',
      invalidIdRes
    );

    // Nonexistent employee
    const nonexistentRes = await request(
      'GET',
      '/v1/team/members/emp-nonexistent-88888',
      null,
      token
    );
    assert(
      nonexistentRes.status === 404 && nonexistentRes.body.success === false,
      'Security: Nonexistent employee ID rejected with 404 Not Found',
      nonexistentRes
    );

    // Reset manager back
    await request('PATCH', '/v1/team/assign', { employeeId: empA.id, managerId: empA.managerId || null }, token);

    console.log(`\n🏁 Team APIs Test Results: ${passed} passed, ${failed} failed.`);
  } catch (err) {
    console.error('Fatal error during team test suite run:', err);
  }
}

runTeamTests();
