/**
 * test_notifications_phase6.js
 * Verification of Phase 6 notification integration into the existing Phase 5 notification system:
 * - Leave approval pending (sent to manager)
 * - Leave approval decision (sent to employee)
 * - Performance review pending (sent to manager)
 * - Performance returned for revision (sent to employee)
 * - Performance approved (sent to employee)
 * - Manager assignment notification
 * - Existing notification endpoints: GET /v1/notifications, unread-count, PATCH read/unread, mark-all-read
 * - Regression check on Phase 5 notifications
 */

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

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 Starting Phase 6 Notifications Integration Test');
  console.log('======================================================\n');

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

  // 1. Generate role-based JWT tokens
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

  // 2. Check initial notification counts via existing endpoint
  console.log('--- 1. Initial Notification Counts via Existing API ---');
  const mgrInitUnread = await request('GET', '/v1/notifications/unread-count', null, managerToken);
  assert(mgrInitUnread.status === 200 && mgrInitUnread.body.success, 'Existing API: Manager fetched initial unread count');

  const empInitUnread = await request('GET', '/v1/notifications/unread-count', null, employeeToken);
  assert(empInitUnread.status === 200 && empInitUnread.body.success, 'Existing API: Employee fetched initial unread count');

  // 3. Test Leave Application -> Notifies Manager (LEAVE_APPROVAL_PENDING)
  console.log('\n--- 2. Testing Leave Approval Pending Notification ---');
  const leaveTypesRes = await request('GET', '/v1/leaves/types', null, employeeToken);
  const leaveTypeId = leaveTypesRes.body.data?.[0]?.id || 'lt-annual';

  const testDate = new Date();
  testDate.setFullYear(2040 + Math.floor(Math.random() * 5));
  testDate.setDate(testDate.getDate() + ((1 + 7 - testDate.getDay()) % 7 || 7));
  const startDate = testDate.toISOString().split('T')[0];
  testDate.setDate(testDate.getDate() + 1);
  const endDate = testDate.toISOString().split('T')[0];

  const leavePayload = {
    leaveTypeId,
    startDate,
    endDate,
    reason: 'Notification Integration Test ' + Date.now(),
  };

  const leaveApplyRes = await request('POST', '/v1/leaves/apply', leavePayload, employeeToken);
  assert(leaveApplyRes.status === 201 && leaveApplyRes.body.success, 'Leave: Employee successfully applied for leave');
  const leaveId = leaveApplyRes.body.data?.id;

  const getItems = (res) => (Array.isArray(res.body?.data?.items) ? res.body.data.items : Array.isArray(res.body?.data) ? res.body.data : []);

  // Verify Manager received LEAVE_APPROVAL_PENDING via existing GET /v1/notifications
  const mgrNotifsAfterLeave = await request('GET', '/v1/notifications', null, managerToken);
  const leavePendingNotif = getItems(mgrNotifsAfterLeave).find(
    (n) => n.eventType === 'LEAVE_APPROVAL_PENDING' || (n.title && n.title.includes('Leave Request Submitted'))
  );
  assert(
    !!leavePendingNotif,
    'Notification: Manager received LEAVE_APPROVAL_PENDING notification on leave submission',
    leavePendingNotif
  );
  if (leavePendingNotif) {
    console.log(`   Notification title: "${leavePendingNotif.title}"`);
    console.log(`   Action URL: "${leavePendingNotif.actionUrl || leavePendingNotif.action_url}"`);
  }

  // 4. Test Leave Approval Decision -> Notifies Employee (LEAVE_APPROVED)
  console.log('\n--- 3. Testing Leave Decision Notification ---');
  const pendingWfRes = await request('GET', '/v1/workflows/pending?entityType=LEAVE_REQUEST', null, managerToken);
  const wfItem = (pendingWfRes.body.data || []).find((w) => w.entityId === leaveId);

  if (wfItem) {
    const actRes = await request('POST', `/v1/workflows/${wfItem.id}/action`, {
      action: 'APPROVE',
      comments: 'Approved by Manager for notification verification',
    }, managerToken);
    assert(actRes.status === 200 && actRes.body.success, 'Workflow: Manager approved leave request');
  }

  const empNotifsAfterApprove = await request('GET', '/v1/notifications', null, employeeToken);
  const leaveApprovedNotif = getItems(empNotifsAfterApprove).find(
    (n) => n.eventType === 'LEAVE_APPROVED' || (n.title && n.title.toLowerCase().includes('leave') && n.title.toLowerCase().includes('approved'))
  );
  assert(
    !!leaveApprovedNotif,
    'Notification: Employee received LEAVE_APPROVED notification upon manager approval',
    leaveApprovedNotif
  );

  // 5. Test Performance Appraisal Lifecycle Notifications
  console.log('\n--- 4. Testing Performance Review Lifecycle Notifications ---');
  const periodName = `Perf-Notif-${Date.now()}`;
  const periodCode = `NOTIF-${Date.now()}`;
  const periodRes = await request('POST', '/v1/performance/periods', {
    name: periodName,
    code: periodCode,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    reviewDeadline: '2026-11-30',
  }, adminToken);
  assert(periodRes.status === 201 && periodRes.body.data?.id, 'Performance: Admin created review period');
  const periodId = periodRes.body.data?.id;

  // Create appraisal draft
  const appraisalRes = await request('POST', '/v1/performance/records', {
    periodId,
    reviewPeriod: periodName,
    selfAssessment: 'Consistent high delivery and innovation.',
    goals: [{ title: 'Deliver Phase 6', description: 'Complete all prompts', weightage: 100 }],
  }, employeeToken);
  assert(appraisalRes.status === 201 && appraisalRes.body.data?.id, 'Performance: Employee created appraisal draft');
  const appraisalId = appraisalRes.body.data?.id;

  // Employee submits self-review -> Notifies Manager (PERFORMANCE_REVIEW_PENDING)
  const submitRes = await request('POST', `/v1/performance/records/${appraisalId}/submit`, {}, employeeToken);
  assert(submitRes.status === 200 && submitRes.body.data?.status === 'SUBMITTED', 'Workflow: Employee submitted appraisal');

  const mgrPerfNotifs = await request('GET', '/v1/notifications', null, managerToken);
  const perfPendingNotif = getItems(mgrPerfNotifs).find(
    (n) => n.eventType === 'PERFORMANCE_REVIEW_PENDING' || (n.title && n.title.toLowerCase().includes('performance review pending'))
  );
  assert(
    !!perfPendingNotif,
    'Notification: Manager received PERFORMANCE_REVIEW_PENDING notification on appraisal submission',
    perfPendingNotif
  );

  // Manager returns for revision -> Notifies Employee (PERFORMANCE_RETURNED)
  const returnRes = await request('POST', `/v1/performance/records/${appraisalId}/return`, {
    reason: 'Please elaborate on goal outcomes with metrics',
  }, managerToken);
  assert(returnRes.status === 200 && returnRes.body.data?.status === 'RETURNED', 'Workflow: Manager returned appraisal');

  const empReturnNotifs = await request('GET', '/v1/notifications', null, employeeToken);
  const perfReturnedNotif = getItems(empReturnNotifs).find(
    (n) => n.eventType === 'PERFORMANCE_RETURNED' || (n.title && n.title.toLowerCase().includes('returned'))
  );
  assert(
    !!perfReturnedNotif,
    'Notification: Employee received PERFORMANCE_RETURNED notification on manager revision return',
    perfReturnedNotif
  );

  // Employee resubmits
  await request('POST', `/v1/performance/records/${appraisalId}/submit`, {}, employeeToken);

  // Manager reviews
  const mgrReviewRes = await request('POST', `/v1/performance/records/${appraisalId}/manager-review`, {
    rating: 4.8,
    feedback: 'Excellent work across all milestones',
    reviewerComments: 'Promote to Senior Engineer. Outstanding execution.',
  }, managerToken);
  assert(mgrReviewRes.status === 200 && mgrReviewRes.body.data?.status === 'UNDER_REVIEW', 'Workflow: Manager completed review', mgrReviewRes);

  // HR approves -> Notifies Employee (PERFORMANCE_APPROVED)
  const hrApproveRes = await request('POST', `/v1/performance/records/${appraisalId}/hr-approve`, {
    comments: 'Approved by HR Operations',
  }, hrToken);
  assert(hrApproveRes.status === 200 && hrApproveRes.body.data?.status === 'APPROVED', 'Workflow: HR completed final approval');

  const empApproveNotifs = await request('GET', '/v1/notifications', null, employeeToken);
  const perfApprovedNotif = getItems(empApproveNotifs).find(
    (n) => n.eventType === 'PERFORMANCE_APPROVED' || (n.title && n.title.toLowerCase().includes('performance appraisal approved'))
  );
  assert(
    !!perfApprovedNotif,
    'Notification: Employee received PERFORMANCE_APPROVED notification upon HR final sign-off',
    perfApprovedNotif
  );

  // 6. Test Manager Assignment Notification (MANAGER_ASSIGNED)
  console.log('\n--- 5. Testing Manager Assignment Notification ---');
  const assignRes = await request('PATCH', '/v1/team/assign', {
    employeeId: 'emp-1789565076012',
    managerId: 'emp-1789558457030',
  }, adminToken);
  assert(assignRes.status === 200, 'Team: Admin assigned manager to employee', assignRes);

  const empMgrNotifs = await request('GET', '/v1/notifications', null, employeeToken);
  const mgrAssignedNotif = getItems(empMgrNotifs).find(
    (n) => n.eventType === 'MANAGER_ASSIGNED' || (n.title && n.title.toLowerCase().includes('manager'))
  );
  assert(!!mgrAssignedNotif, 'Notification: Employee received MANAGER_ASSIGNED notification');

  // 7. Test Existing Notification Endpoints (Unread count, Mark as Read, Mark all Read)
  console.log('\n--- 6. Testing Existing Read/Unread & Badge Functionality ---');
  const notifsListRes = await request('GET', '/v1/notifications', null, employeeToken);
  const allEmpNotifs = getItems(notifsListRes);
  assert(allEmpNotifs.length > 0, 'Existing API: Employee has retrieved notification list');

  const unreadNotif = allEmpNotifs.find((n) => !n.isRead && !n.is_read);
  if (unreadNotif) {
    const readRes = await request('PATCH', `/v1/notifications/${unreadNotif.id}/read`, {}, employeeToken);
    assert(readRes.status === 200 && readRes.body.success, 'Existing API: Marked single notification as read');

    const unreadRes = await request('PATCH', `/v1/notifications/${unreadNotif.id}/unread`, {}, employeeToken);
    assert(unreadRes.status === 200 && unreadRes.body.success, 'Existing API: Marked single notification as unread');
  }

  // Mark all read
  const markAllRes = await request('POST', '/v1/notifications/mark-all-read', {}, employeeToken);
  assert(markAllRes.status === 200 && markAllRes.body.success, 'Existing API: POST /v1/notifications/mark-all-read succeeds');

  const finalUnreadRes = await request('GET', '/v1/notifications/unread-count', null, employeeToken);
  assert(finalUnreadRes.body.data?.unreadCount === 0, 'Existing API: Unread count reset to 0 after mark-all-read');

  // 8. Regression Check: Phase 5 Notifications
  console.log('\n--- 7. Regression Check: Phase 5 Notifications ---');
  const ticketRes = await request('POST', '/v1/helpdesk/tickets', {
    subject: 'Regression Verification Ticket ' + Date.now(),
    description: 'Testing Phase 5 ticket notification',
    category: 'IT_SUPPORT',
    priority: 'MEDIUM',
  }, employeeToken);
  assert(ticketRes.status === 201, 'Phase 5: Created helpdesk ticket without issue');

  const notifsAfterTicket = await request('GET', '/v1/notifications', null, employeeToken);
  const hasTicketNotif = getItems(notifsAfterTicket).some(
    (n) => n.eventType?.startsWith('TICKET_') || (n.title && n.title.includes('Ticket'))
  );
  assert(hasTicketNotif, 'Phase 5: Helpdesk ticket notifications continue to work seamlessly');

  console.log('\n======================================================');
  console.log(`🎉 Test Run Completed: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
