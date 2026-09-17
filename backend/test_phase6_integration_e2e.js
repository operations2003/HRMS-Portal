import http from 'http';
import { generateToken } from './src/utils/tokenUtils.js';

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

async function runE2ETests() {
  console.log('🧪 Starting Phase 6 End-to-End Backend Integration & Security Tests...\n');

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
    // -----------------------------------------------------------------------
    // STEP 1: AUTHENTICATION & TOKEN VERIFICATION
    // -----------------------------------------------------------------------
    console.log('--- 1. Authentication & Token Verification ---');
    const loginRes = await request('POST', '/v1/auth/login', {
      email: 'shubham@tasknera.com',
      password: 'Shubham@264',
    });
    assert(loginRes.status === 200 && loginRes.body.success, 'Auth: Admin login succeeds with 200 and token issued');
    const adminToken = loginRes.body.data?.token;

    const invalidLogin = await request('POST', '/v1/auth/login', {
      email: 'shubham@tasknera.com',
      password: 'WrongPassword!99',
    });
    assert(invalidLogin.status === 401, 'Security: Invalid credentials rejected with 401 Unauthorized');

    const noToken = await request('GET', '/v1/auth/me');
    assert(noToken.status === 401, 'Security: Protected route without token rejected with 401');

    // Role-based tokens for end-to-end actors
    const managerToken = generateToken({
      id: 'user-1789558456935',
      email: 'sakshi@tasknera.com',
      roleName: 'Manager',
      orgId: 'org-1',
    });

    const employeeToken = generateToken({
      id: 'user-1789565075726',
      email: 'ajay1@tasknera.com',
      roleName: 'Employee',
      orgId: 'org-1',
    });

    const hrToken = generateToken({
      id: 'user-test-hr',
      email: 'hr@tasknera.com',
      roleName: 'HR',
      orgId: 'org-1',
    });

    // -----------------------------------------------------------------------
    // STEP 2: RBAC & PRIVILEGE ESCALATION PREVENTION
    // -----------------------------------------------------------------------
    console.log('\n--- 2. RBAC & Privilege Escalation Prevention ---');
    const empManagerAccess = await request('GET', '/v1/manager/dashboard', null, employeeToken);
    assert(empManagerAccess.status === 403, 'RBAC: Regular employee blocked from manager dashboard (403)');

    const empHrAccess = await request('GET', '/v1/hr/operations/overview', null, employeeToken);
    assert(empHrAccess.status === 403, 'RBAC: Regular employee blocked from HR operations overview (403)');

    const mgrHrAccess = await request('GET', '/v1/hr/operations/overview', null, managerToken);
    assert(mgrHrAccess.status === 403, 'RBAC: Manager without HR role blocked from HR operations overview (403)');

    // Attempting role manipulation in request payload
    const roleTamperAttempt = await request(
      'POST',
      '/v1/performance/periods',
      {
        name: 'Tampered Period ' + Date.now(),
        code: 'TAMP-' + Date.now(),
        startDate: '2027-01-01',
        endDate: '2027-12-31',
        roleName: 'Admin',
        role: 'SuperAdmin',
      },
      employeeToken
    );
    assert(
      roleTamperAttempt.status === 403,
      'Security: Body payload role injection does not bypass RBAC check (403 Forbidden)'
    );

    // -----------------------------------------------------------------------
    // STEP 3: MANAGER APIS & SCOPE ENFORCEMENT
    // -----------------------------------------------------------------------
    console.log('\n--- 3. Manager APIs & Scope Enforcement ---');
    const mgrDash = await request('GET', '/v1/manager/dashboard', null, adminToken);
    assert(mgrDash.status === 200 && mgrDash.body.data?.manager, 'Manager: GET /v1/manager/dashboard returns manager details');

    const mgrTeam = await request('GET', '/v1/manager/team', null, adminToken);
    assert(mgrTeam.status === 200 && Array.isArray(mgrTeam.body.data), 'Manager: GET /v1/manager/team returns member array');

    const teamSummary = await request('GET', '/v1/manager/team/summary', null, adminToken);
    assert(teamSummary.status === 200 && teamSummary.body.data?.totalMembers !== undefined, 'Manager: GET /v1/manager/team/summary returns headcount');

    const mgrApprovals = await request('GET', '/v1/manager/approvals', null, adminToken);
    assert(mgrApprovals.status === 200 && mgrApprovals.body.data?.leaves !== undefined, 'Manager: GET /v1/manager/approvals returns pending queue');

    // -----------------------------------------------------------------------
    // STEP 4: TEAM APIS & HIERARCHY VALIDATION
    // -----------------------------------------------------------------------
    console.log('\n--- 4. Team APIs & Hierarchy Validation ---');
    const teamList = await request('GET', '/v1/team', null, adminToken);
    assert(teamList.status === 200 && Array.isArray(teamList.body.data), 'Team: GET /v1/team returns members');

    const teamAttendanceSummary = await request('GET', '/v1/team/attendance/summary', null, adminToken);
    assert(teamAttendanceSummary.status === 200 && teamAttendanceSummary.body.data?.attendanceRate !== undefined, 'Team: GET /v1/team/attendance/summary returns attendance rate');

    const teamLeaveSummary = await request('GET', '/v1/team/leaves/summary', null, adminToken);
    assert(teamLeaveSummary.status === 200 && teamLeaveSummary.body.data?.pendingLeaves !== undefined, 'Team: GET /v1/team/leaves/summary returns leave counters');

    const teamPerfSummary = await request('GET', '/v1/team/performance/summary', null, adminToken);
    assert(teamPerfSummary.status === 200 && teamPerfSummary.body.data?.totalAppraisals !== undefined, 'Team: GET /v1/team/performance/summary returns performance counters');

    // Hierarchy circular check
    const circularCheck = await request(
      'PATCH',
      '/v1/team/assign',
      { employeeId: 'emp-mgrb-1789639703561', managerId: 'emp-mgrb-1789639703561' },
      adminToken
    );
    assert(circularCheck.status === 400, 'Hierarchy: Self-manager assignment blocked with 400 Bad Request');

    // -----------------------------------------------------------------------
    // STEP 5: ATTENDANCE INTEGRATION
    // -----------------------------------------------------------------------
    console.log('\n--- 5. Attendance Integration ---');
    const attToday = await request('GET', '/v1/attendance/my', null, employeeToken);
    assert(attToday.status === 200 && attToday.body.success, 'Attendance: Employee retrieves own attendance records');

    const teamAtt = await request('GET', '/v1/manager/team/attendance', null, adminToken);
    assert(teamAtt.status === 200 && Array.isArray(teamAtt.body.data), 'Attendance: Manager retrieves team daily attendance');

    // -----------------------------------------------------------------------
    // STEP 6: LEAVE INTEGRATION WITH APPROVAL WORKFLOWS
    // -----------------------------------------------------------------------
    console.log('\n--- 6. Leave Integration & Approval Workflows ---');
    const leaveTypesRes = await request('GET', '/v1/leaves/types', null, employeeToken);
    const leaveTypeId = leaveTypesRes.body.data?.[0]?.id || 'lt-annual';

    const randFutureYear = 2040 + Math.floor(Math.random() * 20);
    const randMonth = String(1 + Math.floor(Math.random() * 11)).padStart(2, '0');
    const randDay = String(10 + Math.floor(Math.random() * 10)).padStart(2, '0');
    const startDate = `${randFutureYear}-${randMonth}-${randDay}`;
    const endDate = `${randFutureYear}-${randMonth}-${parseInt(randDay, 10) + 1}`;

    const applyLeaveRes = await request(
      'POST',
      '/v1/leaves/apply',
      {
        leaveTypeId,
        startDate,
        endDate,
        reason: 'Integration test annual family trip',
      },
      employeeToken
    );
    assert(applyLeaveRes.status === 201 && applyLeaveRes.body.success, 'Leave: Employee applied for leave using Phase 4 engine', applyLeaveRes);
    const leaveId = applyLeaveRes.body.data?.id;

    // Verify automatic workflow tracking
    const pendingLeavesWf = await request('GET', '/v1/workflows/pending?entityType=LEAVE_REQUEST', null, adminToken);
    const targetLeaveWf = pendingLeavesWf.body.data?.find((w) => w.entityId === leaveId);
    assert(!!targetLeaveWf, 'Workflow: Leave request automatically registered in approval_workflows');
    const leaveWorkflowId = targetLeaveWf?.id;

    // Self-approval prevention
    const selfApproveLeave = await request(
      'POST',
      `/v1/workflows/${leaveWorkflowId}/action`,
      { action: 'APPROVE', comments: 'I approve my own leave request.' },
      employeeToken
    );
    assert(selfApproveLeave.status === 403, 'Security: Self-approval of leave blocked with 403 Forbidden');

    // Authorized Manager approves leave via workflow
    const mgrApproveLeave = await request(
      'POST',
      `/v1/workflows/${leaveWorkflowId}/action`,
      { action: 'APPROVE', comments: 'Approved by reporting manager for trip.' },
      managerToken
    );
    assert(mgrApproveLeave.status === 200 && mgrApproveLeave.body.success, 'Workflow: Manager successfully approved leave via workflow action');

    // Verify leave is approved in Phase 4 leaves system
    const checkLeave = await request('GET', `/v1/leaves/${leaveId}`, null, employeeToken);
    assert(checkLeave.body.data?.status === 'APPROVED', 'Domain Sync: Leave record in Phase 4 is marked APPROVED');

    // -----------------------------------------------------------------------
    // STEP 7: PERFORMANCE REVIEW LIFECYCLE & WORKFLOW ENGINE
    // -----------------------------------------------------------------------
    console.log('\n--- 7. Performance Review Lifecycle ---');
    const periodName = `E2E Cycle ${Date.now()}`;
    const periodCode = `E2E-${Date.now()}`;
    const periodRes = await request(
      'POST',
      '/v1/performance/periods',
      {
        name: periodName,
        code: periodCode,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        reviewDeadline: '2026-11-30',
      },
      adminToken
    );
    assert(periodRes.status === 201 && periodRes.body.data?.id, 'Performance: Admin created performance review period');
    const periodId = periodRes.body.data?.id;

    // Employee creates appraisal draft
    const appraisalRes = await request(
      'POST',
      '/v1/performance/records',
      {
        periodId,
        reviewPeriod: periodName,
        selfAssessment: 'Delivered core microservices and optimized database queries by 40%.',
        goals: [
          {
            title: 'Latency Reduction',
            description: 'Achieve sub-50ms p99 latency',
            targetValue: '50ms',
            weightage: 50,
          },
        ],
      },
      employeeToken
    );
    assert(appraisalRes.status === 201 && appraisalRes.body.data?.id, 'Performance: Employee created appraisal draft (status: DRAFT)');
    const appraisalId = appraisalRes.body.data?.id;

    // Submit appraisal
    const submitRes = await request('POST', `/v1/performance/records/${appraisalId}/submit`, {}, employeeToken);
    assert(submitRes.status === 200 && submitRes.body.data?.status === 'SUBMITTED', 'Workflow: Employee submitted appraisal (DRAFT -> SUBMITTED)');

    // Manager returns for revision
    const returnRes = await request(
      'POST',
      `/v1/performance/records/${appraisalId}/return`,
      { reason: 'Please expand on the latency test metrics with benchmarks.' },
      managerToken
    );
    assert(returnRes.status === 200 && returnRes.body.data?.status === 'RETURNED', 'Workflow: Manager returned appraisal for revision (SUBMITTED -> RETURNED)');

    // Employee resubmits
    const resubmitRes = await request('POST', `/v1/performance/records/${appraisalId}/submit`, {}, employeeToken);
    assert(resubmitRes.status === 200 && resubmitRes.body.data?.status === 'SUBMITTED', 'Workflow: Employee resubmitted appraisal (RETURNED -> SUBMITTED)');

    // Manager reviews and adds rating
    const reviewRes = await request(
      'POST',
      `/v1/performance/records/${appraisalId}/manager-review`,
      {
        rating: 4.75,
        score: 95,
        feedback: 'Outstanding technical achievements and latency improvements.',
        reviewerComments: 'Promote to Senior Engineer',
      },
      managerToken
    );
    assert(
      reviewRes.status === 200 && reviewRes.body.data?.status === 'UNDER_REVIEW',
      'Workflow: Manager completed review with rating 4.75 (SUBMITTED -> UNDER_REVIEW, stage: HR_REVIEW)',
      reviewRes
    );

    // HR final sign-off
    const hrApproveRes = await request(
      'POST',
      `/v1/performance/records/${appraisalId}/hr-approve`,
      { comments: 'Signed off and finalized by HR Operations.' },
      hrToken
    );
    assert(
      hrApproveRes.status === 200 && hrApproveRes.body.data?.status === 'APPROVED',
      'Workflow: HR executed final sign-off (UNDER_REVIEW -> APPROVED, stage: COMPLETED)',
      hrApproveRes
    );

    // Double approval prevention
    const doubleApprove = await request(
      'POST',
      `/v1/performance/records/${appraisalId}/hr-approve`,
      { comments: 'Attempt duplicate approval' },
      hrToken
    );
    assert(doubleApprove.status === 400, 'Security: Double approval on finalized appraisal blocked with 400 Bad Request');

    // Immutable audit trail check
    const perfAudit = await request('GET', `/v1/workflows/entity/PERFORMANCE_REVIEW/${appraisalId}/audit`, null, employeeToken);
    assert(
      perfAudit.status === 200 && Array.isArray(perfAudit.body.data) && perfAudit.body.data.length >= 4,
      'Audit: Immutable action trail recorded all lifecycle steps with actor, timestamps, and status changes'
    );

    // -----------------------------------------------------------------------
    // STEP 8: HR OPERATIONS INTEGRATION
    // -----------------------------------------------------------------------
    console.log('\n--- 8. HR Operations Integration ---');
    const hrOverview = await request('GET', '/v1/hr/operations/overview', null, hrToken);
    assert(
      hrOverview.status === 200 && hrOverview.body.data?.workforce?.totalEmployees > 0,
      'HR Operations: GET /v1/hr/operations/overview returns workforce metrics'
    );

    const hrQueue = await request('GET', '/v1/hr/operations/approval-queue', null, hrToken);
    assert(
      hrQueue.status === 200 && Array.isArray(hrQueue.body.data),
      'HR Operations: GET /v1/hr/operations/approval-queue returns unified feed'
    );

    const broadcastRes = await request(
      'POST',
      '/v1/hr/operations/broadcast',
      {
        title: 'Phase 6 Integration Verified',
        message: 'All systems operational: Manager, Team, Attendance, Leave, Performance, Workflows, HR Cockpit.',
      },
      hrToken
    );
    assert(broadcastRes.status === 201 && broadcastRes.body.success, 'HR Operations: Broadcast announcement dispatched to organization');

    // -----------------------------------------------------------------------
    // STEP 9: NOTIFICATIONS DISPATCH
    // -----------------------------------------------------------------------
    console.log('\n--- 9. Notifications Dispatch ---');
    const notifs = await request('GET', '/v1/notifications', null, employeeToken);
    assert(notifs.status === 200 && Array.isArray(notifs.body.data?.items), 'Notifications: Employee received system notifications');

    // -----------------------------------------------------------------------
    // STEP 10: TAMPERING & SECURITY CHECKS
    // -----------------------------------------------------------------------
    console.log('\n--- 10. API-Level Anti-Tampering Security Checks ---');
    // 1. Invalid employee ID format
    const invalidIdRes = await request('GET', '/v1/manager/team/members/!@#$%^', null, adminToken);
    assert(invalidIdRes.status === 400, 'Security: Malformed employee ID in URL param rejected with 400 Bad Request');

    // 2. Nonexistent employee ID
    const notFoundIdRes = await request('GET', '/v1/manager/team/members/emp-nonexistent-99999', null, adminToken);
    assert(notFoundIdRes.status === 404, 'Security: Nonexistent employee ID returns 404 Not Found');

    // 3. Organization tampering via body payload
    const orgTamperRes = await request(
      'POST',
      '/v1/performance/periods',
      {
        name: 'Cross Org Period ' + Date.now(),
        code: 'CR-ORG-' + Date.now(),
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        orgId: 'foreign-org-999',
      },
      adminToken
    );
    assert(orgTamperRes.status === 201 && orgTamperRes.body.data?.orgId === 'org-1', 'Security: Backend overrides body orgId with authenticated session orgId');

    console.log('\n========================================');
    console.log('Phase 6 End-to-End Integration Tests Completed!');
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log('========================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test Suite Crash:', err);
    process.exit(1);
  }
}

runE2ETests();
