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

async function runWorkflowTests() {
  console.log('🧪 Starting Phase 6 Approval Workflows Functional & Security Tests...\n');

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
    // Generate JWT Tokens for different roles
    // -----------------------------------------------------------------------
    const adminToken = generateToken({
      id: 'user-superadmin-shubham',
      email: 'shubham@tasknera.com',
      roleName: 'Admin',
      orgId: 'org-1',
    });

    // Sakshi is Manager of Ajay
    const managerToken = generateToken({
      id: 'user-1789558456935',
      email: 'sakshi@tasknera.com',
      roleName: 'Manager',
      orgId: 'org-1',
    });

    // Ajay is Employee
    const employeeToken = generateToken({
      id: 'user-1789565075726',
      email: 'ajay1@tasknera.com',
      roleName: 'Employee',
      orgId: 'org-1',
    });

    // HR user
    const hrToken = generateToken({
      id: 'user-test-hr',
      email: 'hr@tasknera.com',
      roleName: 'HR',
      orgId: 'org-1',
    });

    // -----------------------------------------------------------------------
    // 1. Authentication & Security Gate Checks
    // -----------------------------------------------------------------------
    console.log('--- 1. Authentication & Role Gate Checks ---');
    const unauth = await request('GET', '/v1/workflows/pending');
    assert(unauth.status === 401, 'Security: Unauthenticated request rejected with 401');

    const empQueueRes = await request('GET', '/v1/workflows/pending', null, employeeToken);
    assert(
      empQueueRes.status === 403,
      'RBAC: Regular employee blocked from pending approval queue (403)'
    );

    // -----------------------------------------------------------------------
    // 2. Pending Queue Inspection
    // -----------------------------------------------------------------------
    console.log('\n--- 2. Pending Approval Queue Retrieval ---');
    const mgrQueue = await request('GET', '/v1/workflows/pending', null, managerToken);
    assert(
      mgrQueue.status === 200 && Array.isArray(mgrQueue.body.data),
      'Manager: GET /v1/workflows/pending returns list of pending items'
    );

    const hrQueue = await request('GET', '/v1/workflows/pending', null, hrToken);
    assert(
      hrQueue.status === 200 && Array.isArray(hrQueue.body.data),
      'HR: GET /v1/workflows/pending returns organization-wide pending queue'
    );

    // -----------------------------------------------------------------------
    // 3. Performance Review Workflow (Employee -> Manager -> HR)
    // -----------------------------------------------------------------------
    console.log('\n--- 3. Performance Review Workflow Lifecycle ---');
    const perfPeriod = `WF-TEST-${Date.now()}`;
    const createPerf = await request(
      'POST',
      '/v1/performance/records',
      {
        reviewPeriod: perfPeriod,
        selfComments: 'High impact full stack delivery and cloud deployments.',
      },
      employeeToken
    );
    assert(createPerf.status === 201, 'Employee created performance appraisal draft');
    const perfRecordId = createPerf.body.data?.id;

    // Submit the appraisal
    const submitPerf = await request(
      'POST',
      `/v1/performance/records/${perfRecordId}/submit`,
      {},
      employeeToken
    );
    assert(submitPerf.status === 200, 'Employee submitted appraisal');

    // Retrieve the workflow instance created for this performance review
    const perfWfRes = await request(
      'GET',
      `/v1/workflows/entity/PERFORMANCE_REVIEW/${perfRecordId}/audit`,
      null,
      employeeToken
    );
    assert(
      perfWfRes.status === 200 && Array.isArray(perfWfRes.body.data) && perfWfRes.body.data.length > 0,
      'Workflow engine initialized audit trail for performance review'
    );

    // Find the workflow instance ID via pending queue or entity
    const pendingItems = await request(
      'GET',
      '/v1/workflows/pending?entityType=PERFORMANCE_REVIEW',
      null,
      adminToken
    );
    const targetWf = pendingItems.body.data.find(
      (w) => w.entityType === 'PERFORMANCE_REVIEW' && w.entityId === perfRecordId
    );
    assert(!!targetWf, 'Found pending workflow instance for performance appraisal');
    const wfId = targetWf?.id;

    // -----------------------------------------------------------------------
    // 4. Security Enforcements: Self-Approval & Cross-Team Prevention
    // -----------------------------------------------------------------------
    console.log('\n--- 4. Self-Approval & Scope Prevention ---');
    const empSelfAction = await request(
      'POST',
      `/v1/workflows/${wfId}/action`,
      {
        action: 'APPROVE',
        comments: 'Employee attempting to approve own appraisal',
      },
      employeeToken
    );
    assert(
      empSelfAction.status === 403,
      'Security: Employee self-approval attempt blocked with 403 Forbidden',
      empSelfAction
    );

    // -----------------------------------------------------------------------
    // 5. State Transition Validation: Return for Revision Workflow
    // -----------------------------------------------------------------------
    console.log('\n--- 5. Return for Revision Action ---');
    const returnNoReason = await request(
      'POST',
      `/v1/workflows/${wfId}/action`,
      {
        action: 'RETURN',
      },
      managerToken
    );
    assert(
      returnNoReason.status === 400,
      'Validation: Returning without mandatory reason rejected with 400 Bad Request'
    );

    const returnSuccess = await request(
      'POST',
      `/v1/workflows/${wfId}/action`,
      {
        action: 'RETURN',
        comments: 'Please elaborate on KPI #2 delivery metrics.',
      },
      managerToken
    );
    assert(
      returnSuccess.status === 200 && returnSuccess.body.data?.currentStatus === 'RETURNED',
      'Workflow: Manager successfully returned appraisal for revision (SUBMITTED -> RETURNED)',
      returnSuccess
    );

    // Resubmit via performance API
    await request('POST', `/v1/performance/records/${perfRecordId}/submit`, {}, employeeToken);

    // -----------------------------------------------------------------------
    // 6. Manager Review Action (Manager -> HR)
    // -----------------------------------------------------------------------
    console.log('\n--- 6. Manager Review & Advance to HR ---');
    const managerReviewRes = await request(
      'POST',
      `/v1/workflows/${wfId}/action`,
      {
        action: 'APPROVE',
        rating: 4.8,
        score: 96,
        comments: 'Exceeded performance benchmarks across all modules.',
      },
      managerToken
    );
    assert(
      managerReviewRes.status === 200 &&
        managerReviewRes.body.data?.currentStage === 'HR_REVIEW' &&
        managerReviewRes.body.data?.currentStatus === 'UNDER_REVIEW',
      'Workflow: Manager reviewed and advanced workflow (MANAGER_REVIEW -> HR_REVIEW, status: UNDER_REVIEW)',
      managerReviewRes
    );

    // Manager cannot approve again while in HR_REVIEW
    const mgrPrematureApprove = await request(
      'POST',
      `/v1/workflows/${wfId}/action`,
      {
        action: 'APPROVE',
        comments: 'Manager approving again at HR stage',
      },
      managerToken
    );
    assert(
      mgrPrematureApprove.status === 403,
      'RBAC: Manager blocked from taking action during HR_REVIEW stage (403)'
    );

    // -----------------------------------------------------------------------
    // 7. HR Final Sign-off & Completion
    // -----------------------------------------------------------------------
    console.log('\n--- 7. HR Final Sign-off & Completion ---');
    const hrFinalApprove = await request(
      'POST',
      `/v1/workflows/${wfId}/action`,
      {
        action: 'APPROVE',
        comments: 'HR Final approval confirmed and logged.',
      },
      hrToken
    );
    assert(
      hrFinalApprove.status === 200 &&
        hrFinalApprove.body.data?.currentStage === 'COMPLETED' &&
        hrFinalApprove.body.data?.currentStatus === 'APPROVED',
      'Workflow: HR executed final sign-off (HR_REVIEW -> COMPLETED, status: APPROVED)',
      hrFinalApprove
    );

    // Double approval check on completed workflow
    const doubleApprove = await request(
      'POST',
      `/v1/workflows/${wfId}/action`,
      {
        action: 'APPROVE',
        comments: 'Double approval attempt on completed workflow',
      },
      adminToken
    );
    assert(
      doubleApprove.status === 400,
      'Security: Double approval on completed workflow rejected with 400 Bad Request'
    );

    // -----------------------------------------------------------------------
    // 8. Leave Approval Workflow Integration (Phase 4 Leave Reuse)
    // -----------------------------------------------------------------------
    console.log('\n--- 8. Leave Approval Workflow Integration ---');
    // Fetch available leave type
    const leaveTypesRes = await request('GET', '/v1/leaves/types', null, employeeToken);
    const leaveTypeId = leaveTypesRes.body.data?.[0]?.id;

    const testLeaveStart = `2027-04-12`;
    const testLeaveEnd = `2027-04-13`;

    const applyLeaveRes = await request(
      'POST',
      '/v1/leaves/apply',
      {
        leaveTypeId,
        startDate: testLeaveStart,
        endDate: testLeaveEnd,
        reason: 'Family vacation travel.',
      },
      employeeToken
    );
    assert(
      applyLeaveRes.status === 201 && applyLeaveRes.body.data?.id,
      'Employee applied for leave (reusing Phase 4 leave engine)',
      applyLeaveRes
    );
    const leaveId = applyLeaveRes.body.data?.id;

    // Verify workflow tracking instance was initialized
    const leaveWfAudit = await request(
      'GET',
      `/v1/workflows/entity/LEAVE_REQUEST/${leaveId}/audit`,
      null,
      employeeToken
    );
    assert(
      leaveWfAudit.status === 200 && Array.isArray(leaveWfAudit.body.data) && leaveWfAudit.body.data.length > 0,
      'Workflow engine automatically created workflow tracking instance for leave request'
    );

    // Find the leave workflow instance ID
    const pendingLeaves = await request(
      'GET',
      '/v1/workflows/pending?entityType=LEAVE_REQUEST',
      null,
      adminToken
    );
    const leaveWf = pendingLeaves.body.data.find(
      (w) => w.entityType === 'LEAVE_REQUEST' && w.entityId === leaveId
    );
    assert(!!leaveWf, 'Found pending workflow instance for leave request');
    const leaveWfId = leaveWf?.id;

    // Self-approval prevention on leave request
    const leaveSelfApprove = await request(
      'POST',
      `/v1/workflows/${leaveWfId}/action`,
      {
        action: 'APPROVE',
        comments: 'Employee approving own leave',
      },
      employeeToken
    );
    assert(
      leaveSelfApprove.status === 403,
      'Security: Self-approval on leave request blocked with 403 Forbidden'
    );

    // Manager approves leave request via workflow engine
    const leaveApproveRes = await request(
      'POST',
      `/v1/workflows/${leaveWfId}/action`,
      {
        action: 'APPROVE',
        comments: 'Leave approved by reporting manager.',
      },
      managerToken
    );
    assert(
      leaveApproveRes.status === 200 && leaveApproveRes.body.data?.currentStatus === 'APPROVED',
      'Workflow: Manager approved leave via workflow action (PENDING -> APPROVED)'
    );

    // Verify leave balance and status synchronized in leaveRepository
    const leaveRecordCheck = await request('GET', `/v1/leaves/${leaveId}`, null, employeeToken);
    assert(
      leaveRecordCheck.status === 200 && leaveRecordCheck.body.data?.status === 'APPROVED',
      'Domain Sync: Leave record in Phase 4 leave system updated to APPROVED'
    );

    // -----------------------------------------------------------------------
    // 9. Rejection Workflow Flow
    // -----------------------------------------------------------------------
    console.log('\n--- 9. Rejection Workflow Flow ---');
    const rejectLeaveStart = `2027-05-10`;
    const rejectLeaveEnd = `2027-05-11`;

    const applyRejectLeave = await request(
      'POST',
      '/v1/leaves/apply',
      {
        leaveTypeId,
        startDate: rejectLeaveStart,
        endDate: rejectLeaveEnd,
        reason: 'Leave to be rejected for operational coverage.',
      },
      employeeToken
    );
    const rejectLeaveId = applyRejectLeave.body.data?.id;

    const pendingRejectLeaves = await request(
      'GET',
      '/v1/workflows/pending?entityType=LEAVE_REQUEST',
      null,
      adminToken
    );
    const rejectWf = pendingRejectLeaves.body.data.find(
      (w) => w.entityType === 'LEAVE_REQUEST' && w.entityId === rejectLeaveId
    );
    const rejectWfId = rejectWf?.id;

    // Reject without reason
    const rejectNoReason = await request(
      'POST',
      `/v1/workflows/${rejectWfId}/action`,
      {
        action: 'REJECT',
      },
      managerToken
    );
    assert(
      rejectNoReason.status === 400,
      'Validation: Rejection without reason rejected with 400 Bad Request'
    );

    // Reject with reason
    const rejectSuccess = await request(
      'POST',
      `/v1/workflows/${rejectWfId}/action`,
      {
        action: 'REJECT',
        comments: 'Critical release scheduled during requested dates.',
      },
      managerToken
    );
    assert(
      rejectSuccess.status === 200 && rejectSuccess.body.data?.currentStatus === 'REJECTED',
      'Workflow: Manager successfully rejected leave request (PENDING -> REJECTED)'
    );

    // -----------------------------------------------------------------------
    // 10. Complete Immutable Audit Trail
    // -----------------------------------------------------------------------
    console.log('\n--- 10. Complete Immutable Audit Trail ---');
    const finalAuditRes = await request(
      'GET',
      `/v1/workflows/entity/PERFORMANCE_REVIEW/${perfRecordId}/audit`,
      null,
      employeeToken
    );
    assert(
      finalAuditRes.status === 200 &&
        Array.isArray(finalAuditRes.body.data) &&
        finalAuditRes.body.data.length >= 4,
      'Audit: Complete chronological action trail logged with actor, action, previous/new status, comments, timestamp',
      finalAuditRes.body.data
    );

    const firstAudit = finalAuditRes.body.data[0];
    assert(
      firstAudit.actorUserId &&
        firstAudit.actorName &&
        firstAudit.action &&
        firstAudit.fromStatus &&
        firstAudit.toStatus &&
        firstAudit.timestamp,
      'Audit: Action entry contains all required metadata fields'
    );

    console.log(`\n========================================`);
    console.log(`Phase 6 Workflow Tests Completed!`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during workflow tests:', err);
    process.exit(1);
  }
}

runWorkflowTests();
