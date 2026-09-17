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

async function runPerformanceTests() {
  console.log('🧪 Starting Phase 6 Performance Management APIs Tests...\n');

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
    // Generate test JWT tokens using system token utility
    // -----------------------------------------------------------------------
    const adminToken = generateToken({
      id: 'user-superadmin-shubham',
      email: 'shubham@tasknera.com',
      roleName: 'Admin',
      orgId: 'org-1',
    });

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
    // 1. Authentication & Role Gate Checks
    // -----------------------------------------------------------------------
    console.log('--- 1. Authentication & Security Gates ---');
    const unauth = await request('GET', '/v1/performance/my');
    assert(unauth.status === 401, 'Security: Unauthenticated request rejected with 401');

    const empTeamAccess = await request('GET', '/v1/performance/team', null, employeeToken);
    assert(
      empTeamAccess.status === 403,
      'RBAC: Regular employee cannot access manager team performance endpoint (403)'
    );

    // -----------------------------------------------------------------------
    // 2. Performance Period Management (HR / Admin)
    // -----------------------------------------------------------------------
    console.log('\n--- 2. Performance Period Management ---');
    const empCreatePeriod = await request(
      'POST',
      '/v1/performance/periods',
      {
        name: 'Q3 2026 Appraisal',
        code: `PERF-${Date.now()}`,
        startDate: '2026-07-01',
        endDate: '2026-09-30',
        reviewDeadline: '2026-10-15',
      },
      employeeToken
    );
    assert(
      empCreatePeriod.status === 403,
      'RBAC: Employee blocked from creating performance periods (403)'
    );

    const testPeriodCode = `Q3-2026-${Date.now()}`;
    const createPeriodRes = await request(
      'POST',
      '/v1/performance/periods',
      {
        name: 'Q3 2026 Performance Cycle',
        code: testPeriodCode,
        startDate: '2026-07-01',
        endDate: '2026-09-30',
        reviewDeadline: '2026-10-15',
      },
      adminToken
    );
    assert(
      createPeriodRes.status === 201 && createPeriodRes.body.data?.id,
      'Admin: Successfully created new performance period',
      createPeriodRes
    );
    const periodId = createPeriodRes.body.data?.id;

    const periodsRes = await request('GET', '/v1/performance/periods', null, employeeToken);
    assert(
      periodsRes.status === 200 && Array.isArray(periodsRes.body.data),
      'GET /v1/performance/periods returns active periods'
    );

    // -----------------------------------------------------------------------
    // 3. Performance Record Creation & Goals
    // -----------------------------------------------------------------------
    console.log('\n--- 3. Performance Record Creation & Goals ---');
    const testReviewPeriod = `Q3-2026-${Date.now()}`;
    const createRecordRes = await request(
      'POST',
      '/v1/performance/records',
      {
        reviewPeriod: testReviewPeriod,
        periodId: periodId,
        selfComments: 'Delivered all backend microservices on schedule.',
        goals: [
          {
            title: 'API Performance Tuning',
            description: 'Maintain 99.9% uptime and <200ms latency',
            weightage: 50,
            status: 'ACHIEVED',
          },
        ],
      },
      employeeToken
    );

    assert(
      createRecordRes.status === 201 && createRecordRes.body.data?.id,
      'Employee: Successfully created DRAFT performance appraisal with goal',
      createRecordRes
    );
    const recordId = createRecordRes.body.data?.id;

    // Add Goal to Draft
    const addGoalRes = await request(
      'POST',
      `/v1/performance/records/${recordId}/goals`,
      {
        title: 'Mentorship and Code Reviews',
        description: 'Completed 30+ comprehensive PR reviews',
        weightage: 50,
        status: 'IN_PROGRESS',
      },
      employeeToken
    );
    assert(
      addGoalRes.status === 201 && addGoalRes.body.data?.id,
      'Employee: Added additional goal to DRAFT appraisal'
    );

    // -----------------------------------------------------------------------
    // 4. Duplicate Submission Prevention
    // -----------------------------------------------------------------------
    console.log('\n--- 4. Duplicate Submission Prevention ---');
    const dupRecordRes = await request(
      'POST',
      '/v1/performance/records',
      {
        reviewPeriod: testReviewPeriod,
        selfComments: 'Attempting duplicate record',
      },
      employeeToken
    );
    assert(
      dupRecordRes.status === 409,
      'Security: Duplicate performance appraisal for same period rejected with 409 Conflict',
      dupRecordRes
    );

    // -----------------------------------------------------------------------
    // 5. Self-Approval & Self-Review Prevention
    // -----------------------------------------------------------------------
    console.log('\n--- 5. Self-Approval & Self-Review Prevention ---');
    const selfReviewRes = await request(
      'POST',
      `/v1/performance/records/${recordId}/manager-review`,
      {
        rating: 5.0,
        feedback: 'Giving myself 5 stars!',
      },
      employeeToken
    );
    assert(
      selfReviewRes.status === 403,
      'Security: Employee self-review attempt blocked with 403 Forbidden'
    );

    // -----------------------------------------------------------------------
    // 6. State Transition Integrity (Draft -> Under Review blocked)
    // -----------------------------------------------------------------------
    console.log('\n--- 6. State Transition Integrity ---');
    const prematureReviewRes = await request(
      'POST',
      `/v1/performance/records/${recordId}/manager-review`,
      {
        rating: 4.5,
        feedback: 'Premature evaluation',
      },
      managerToken
    );
    assert(
      prematureReviewRes.status === 400,
      'Workflow: Cannot review appraisal while still in DRAFT status (400)',
      prematureReviewRes
    );

    // -----------------------------------------------------------------------
    // 7. Submit Performance Record (Draft -> Submitted)
    // -----------------------------------------------------------------------
    console.log('\n--- 7. Submit Performance Record ---');
    const submitRes = await request(
      'POST',
      `/v1/performance/records/${recordId}/submit`,
      {},
      employeeToken
    );
    assert(
      submitRes.status === 200 && submitRes.body.data?.status === 'SUBMITTED',
      'Workflow: Employee successfully submitted appraisal (DRAFT -> SUBMITTED)',
      submitRes
    );

    // Cannot resubmit while SUBMITTED
    const resubmitRes = await request(
      'POST',
      `/v1/performance/records/${recordId}/submit`,
      {},
      employeeToken
    );
    assert(
      resubmitRes.status === 400,
      'Workflow: Submitting already submitted appraisal blocked (400)'
    );

    // -----------------------------------------------------------------------
    // 8. Return for Revision Workflow
    // -----------------------------------------------------------------------
    console.log('\n--- 8. Return for Revision Workflow ---');
    const returnNoReason = await request(
      'POST',
      `/v1/performance/records/${recordId}/return`,
      {},
      managerToken
    );
    assert(
      returnNoReason.status === 400,
      'Validation: Returning appraisal requires reason / comments (400)'
    );

    const returnRes = await request(
      'POST',
      `/v1/performance/records/${recordId}/return`,
      {
        reason: 'Please provide metric achievements for Goal #2.',
      },
      managerToken
    );
    assert(
      returnRes.status === 200 && returnRes.body.data?.status === 'RETURNED',
      'Workflow: Manager returned appraisal for revision (SUBMITTED -> RETURNED)',
      returnRes
    );

    // Resubmit after revision
    const submitAfterRevision = await request(
      'POST',
      `/v1/performance/records/${recordId}/submit`,
      {},
      employeeToken
    );
    assert(
      submitAfterRevision.status === 200 && submitAfterRevision.body.data?.status === 'SUBMITTED',
      'Workflow: Employee successfully resubmitted appraisal (RETURNED -> SUBMITTED)'
    );

    // -----------------------------------------------------------------------
    // 9. Manager Review & Rating Enforcement
    // -----------------------------------------------------------------------
    console.log('\n--- 9. Manager Review & Rating Enforcement ---');
    const invalidRatingRes = await request(
      'POST',
      `/v1/performance/records/${recordId}/manager-review`,
      {
        rating: 5.5, // Exceeds 5.00
        feedback: 'Out of range score',
      },
      managerToken
    );
    assert(
      invalidRatingRes.status === 400,
      'Validation: Rating outside 1.00 - 5.00 rejected with 400 Bad Request'
    );

    const validReviewRes = await request(
      'POST',
      `/v1/performance/records/${recordId}/manager-review`,
      {
        rating: 4.5,
        score: 90,
        feedback: 'Exceptional ownership and architecture contributions.',
        reviewerComments: 'Approved for top quartile increment.',
      },
      managerToken
    );
    assert(
      validReviewRes.status === 200 && validReviewRes.body.data?.status === 'UNDER_REVIEW',
      'Workflow: Manager completed review and rating (SUBMITTED -> UNDER_REVIEW)',
      validReviewRes
    );

    // -----------------------------------------------------------------------
    // 10. HR Approval Authorization & Execution
    // -----------------------------------------------------------------------
    console.log('\n--- 10. HR Approval Authorization & Execution ---');
    const managerApproveAttempt = await request(
      'POST',
      `/v1/performance/records/${recordId}/hr-approve`,
      {},
      managerToken
    );
    assert(
      managerApproveAttempt.status === 403,
      'RBAC: Manager without HR/Admin role cannot execute final HR approval (403)'
    );

    const hrApproveRes = await request(
      'POST',
      `/v1/performance/records/${recordId}/hr-approve`,
      {
        comments: 'HR Final Sign-off confirmed.',
      },
      hrToken
    );
    assert(
      hrApproveRes.status === 200 && hrApproveRes.body.data?.status === 'APPROVED',
      'Workflow: HR executed final appraisal sign-off (UNDER_REVIEW -> APPROVED)',
      hrApproveRes
    );

    // -----------------------------------------------------------------------
    // 11. Record Views (Employee, Manager, HR)
    // -----------------------------------------------------------------------
    console.log('\n--- 11. Role-based Performance Views ---');
    const myRecords = await request('GET', '/v1/performance/my', null, employeeToken);
    assert(
      myRecords.status === 200 &&
        Array.isArray(myRecords.body.data) &&
        myRecords.body.data.some((r) => r.id === recordId),
      'Employee: GET /v1/performance/my returns employee own appraisal'
    );

    const teamRecords = await request('GET', '/v1/performance/team', null, managerToken);
    assert(
      teamRecords.status === 200 &&
        Array.isArray(teamRecords.body.data) &&
        teamRecords.body.data.some((r) => r.id === recordId),
      'Manager: GET /v1/performance/team returns assigned team appraisal'
    );

    const allRecords = await request('GET', '/v1/performance/records', null, hrToken);
    const recordsList = allRecords.body.data?.records || allRecords.body.data;
    assert(
      allRecords.status === 200 &&
        Array.isArray(recordsList) &&
        recordsList.some((r) => r.id === recordId),
      'HR: GET /v1/performance/records returns organization appraisals'
    );

    // -----------------------------------------------------------------------
    // 12. Audit Trail / Workflow History
    // -----------------------------------------------------------------------
    console.log('\n--- 12. Complete Workflow Audit Trail ---');
    const historyRes = await request(
      'GET',
      `/v1/performance/records/${recordId}/history`,
      null,
      employeeToken
    );
    assert(
      historyRes.status === 200 && Array.isArray(historyRes.body.data) && historyRes.body.data.length >= 4,
      'Audit: Complete history trail logged (CREATED, SUBMITTED, RETURNED, SUBMITTED, UNDER_REVIEW, APPROVED)',
      historyRes.body.data
    );

    // -----------------------------------------------------------------------
    // 13. Rejection Lifecycle Flow
    // -----------------------------------------------------------------------
    console.log('\n--- 13. Rejection Lifecycle Flow ---');
    const rejectPeriod = `Q4-2026-${Date.now()}`;
    const createRejectAppraisal = await request(
      'POST',
      '/v1/performance/records',
      {
        reviewPeriod: rejectPeriod,
        selfComments: 'Appraisal to be rejected.',
      },
      employeeToken
    );
    const rejectRecordId = createRejectAppraisal.body.data?.id;

    // Submit it
    await request('POST', `/v1/performance/records/${rejectRecordId}/submit`, {}, employeeToken);

    // Reject without reason
    const rejectNoReason = await request(
      'POST',
      `/v1/performance/records/${rejectRecordId}/reject`,
      {},
      managerToken
    );
    assert(
      rejectNoReason.status === 400,
      'Validation: Rejection without mandatory reason rejected with 400'
    );

    // Reject with reason
    const rejectSuccess = await request(
      'POST',
      `/v1/performance/records/${rejectRecordId}/reject`,
      {
        rejectionReason: 'Objectives not aligned with department KPIs.',
      },
      managerToken
    );
    assert(
      rejectSuccess.status === 200 && rejectSuccess.body.data?.status === 'REJECTED',
      'Workflow: Successfully rejected appraisal with mandatory reason (SUBMITTED -> REJECTED)'
    );

    console.log(`\n========================================`);
    console.log(`Phase 6 Performance API Tests Completed!`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during performance tests:', err);
    process.exit(1);
  }
}

runPerformanceTests();
