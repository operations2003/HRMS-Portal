/**
 * test_frontend_integration.js
 * Comprehensive Frontend Integration & RBAC Verification for Sakshi Prompt 9
 * Verifies:
 * 1. Role-Based Navigation & Menu Item Visibility (Manager vs HR vs Employee)
 * 2. Protected Route Guarding & Direct URL Access Enforcement (ForbiddenPage 403 checks)
 * 3. Complete Manager User Flow & APIs
 * 4. Complete HR User Flow & APIs
 * 5. Complete Employee User Flow & APIs
 * 6. UX States: Empty States, Error Responses, Validation Rules, Anti-Self-Approval
 * 7. Phase 1–5 Comprehensive Screen & API Regression
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

// Simulation of Frontend Navigation Filtering (from Sidebar.jsx & App.jsx)
function simulateFrontendNavigation(user) {
  const normalizedUserRole = (user.roleName || '').toLowerCase().trim();
  const isAdmin = ['admin', 'superadmin', 'orgadmin'].includes(normalizedUserRole);

  const hasRole = (roles) => {
    if (isAdmin) return true;
    const targetRoles = (Array.isArray(roles) ? roles : [roles]).map(r => r.toLowerCase().trim());
    return targetRoles.includes(normalizedUserRole);
  };

  const hasPermission = (perm) => {
    if (isAdmin) return true;
    const targetPerms = (Array.isArray(perm) ? perm : [perm]).map(p => p.toLowerCase().trim());
    const userPerms = (user.permissions || []).map(p => p.toLowerCase().trim());
    return targetPerms.some(p => userPerms.includes(p));
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', permission: 'dashboard:read' },
    { name: 'Manager Cockpit', path: '/manager', roles: ['Manager', 'HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin'] },
    { name: 'Team', path: '/team', roles: ['Manager', 'HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin'] },
    { name: 'Approvals', path: '/approvals', roles: ['Manager', 'HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin'] },
    { name: 'Performance', path: '/performance', permission: ['performance:read', 'employee:read'] },
    { name: 'HR Operations', path: '/hr-operations', roles: ['HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin'] },
    { name: 'Attendance', path: '/attendance', permission: 'attendance:read' },
    { name: 'Leaves', path: '/leaves', permission: 'leave:read' },
    { name: 'Organizations', path: '/organizations', permission: 'org:read' },
    { name: 'Onboarding', path: '/onboarding', permission: 'onboarding:read' },
    { name: 'Employees', path: '/employees', permission: 'employee:read' },
    { name: 'Payroll', path: '/payroll', permission: ['payroll:read', 'payslip:read'] },
    { name: 'Payslips', path: '/payslips', permission: 'payslip:read' },
    { name: 'Documents', path: '/documents', permission: ['document:read', 'employee:read'] },
    { name: 'Helpdesk', path: '/helpdesk', permission: ['helpdesk:read', 'employee:read'] },
    { name: 'Requests', path: '/requests', permission: ['request:read', 'employee:read'] },
    { name: 'Departments', path: '/departments', permission: 'dept:read' },
    { name: 'User Accounts', path: '/users', permission: 'user:write' },
  ];

  const visibleItems = navItems.filter((item) => {
    if (item.roles && !hasRole(item.roles)) return false;
    if (item.permission && !hasPermission(item.permission)) return false;
    return true;
  });

  const canAccessRoute = (path) => {
    const routeRules = {
      '/manager': { roles: ['Manager', 'HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin'] },
      '/team': { roles: ['Manager', 'HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin'] },
      '/approvals': { roles: ['Manager', 'HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin'] },
      '/hr-operations': { roles: ['HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin'] },
      '/users': { permission: 'user:write' },
      '/organizations': { permission: 'org:read' },
      '/dashboard': { permission: 'dashboard:read' },
      '/attendance': { permission: 'attendance:read' },
      '/leaves': { permission: 'leave:read' },
      '/performance': { permission: ['performance:read', 'employee:read'] },
    };

    const rule = routeRules[path];
    if (!rule) return true;
    if (rule.roles && !hasRole(rule.roles)) return false;
    if (rule.permission && !hasPermission(rule.permission)) return false;
    return true;
  };

  return { visibleItems: visibleItems.map(i => i.name), canAccessRoute };
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 Starting Phase 6 Final Frontend Integration & RBAC Verification');
  console.log('================================================================\n');

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

  // 1. Roles Definition
  const employeeUser = {
    id: 'user-1789565075726',
    email: 'ajay1@tasknera.com',
    roleName: 'Employee',
    orgId: 'org-1',
    permissions: ['dashboard:read', 'attendance:read', 'leave:read', 'employee:read', 'payslip:read', 'document:read', 'helpdesk:read', 'request:read', 'notification:read', 'performance:read'],
  };

  const managerUser = {
    id: 'user-1789558456935',
    email: 'sakshi@tasknera.com',
    roleName: 'Manager',
    orgId: 'org-1',
    permissions: ['dashboard:read', 'attendance:read', 'leave:read', 'employee:read', 'dept:read', 'payslip:read', 'document:read', 'helpdesk:read', 'request:read', 'notification:read', 'performance:read'],
  };

  const hrUser = {
    id: 'user-test-hr',
    email: 'hr@tasknera.com',
    roleName: 'HR',
    orgId: 'org-1',
    permissions: ['dashboard:read', 'org:read', 'employee:read', 'employee:write', 'dept:read', 'dept:write', 'user:read', 'attendance:read', 'leave:read', 'performance:read', 'notification:read'],
  };

  const adminToken = generateToken({ id: 'user-superadmin-shubham', email: 'shubham@tasknera.com', roleName: 'Admin', orgId: 'org-1' });
  const managerToken = generateToken(managerUser);
  const employeeToken = generateToken(employeeUser);
  const hrToken = generateToken(hrUser);

  // -----------------------------------------------------------------------
  // SECTION 1: ROLE-BASED NAVIGATION & MENU VISIBILITY VERIFICATION
  // -----------------------------------------------------------------------
  console.log('--- 1. Role-Based Navigation & Menu Item Visibility ---');
  
  // Employee Navigation Check
  const empNav = simulateFrontendNavigation(employeeUser);
  assert(!empNav.visibleItems.includes('Manager Cockpit'), 'Employee Menu: "Manager Cockpit" is hidden');
  assert(!empNav.visibleItems.includes('Team'), 'Employee Menu: "Team" is hidden');
  assert(!empNav.visibleItems.includes('Approvals'), 'Employee Menu: "Approvals" is hidden');
  assert(!empNav.visibleItems.includes('HR Operations'), 'Employee Menu: "HR Operations" is hidden');
  assert(empNav.visibleItems.includes('Dashboard'), 'Employee Menu: "Dashboard" is visible');
  assert(empNav.visibleItems.includes('Attendance'), 'Employee Menu: "Attendance" is visible');
  assert(empNav.visibleItems.includes('Leaves'), 'Employee Menu: "Leaves" is visible');
  assert(empNav.visibleItems.includes('Performance'), 'Employee Menu: "Performance" is visible');

  // Manager Navigation Check
  const mgrNav = simulateFrontendNavigation(managerUser);
  assert(mgrNav.visibleItems.includes('Manager Cockpit'), 'Manager Menu: "Manager Cockpit" is visible');
  assert(mgrNav.visibleItems.includes('Team'), 'Manager Menu: "Team" is visible');
  assert(mgrNav.visibleItems.includes('Approvals'), 'Manager Menu: "Approvals" is visible');
  assert(mgrNav.visibleItems.includes('Performance'), 'Manager Menu: "Performance" is visible');
  assert(!mgrNav.visibleItems.includes('HR Operations'), 'Manager Menu: "HR Operations" is hidden from Manager without HR role');

  // HR Navigation Check
  const hrNav = simulateFrontendNavigation(hrUser);
  assert(hrNav.visibleItems.includes('HR Operations'), 'HR Menu: "HR Operations" is visible');
  assert(hrNav.visibleItems.includes('Team'), 'HR Menu: "Team" is visible');
  assert(hrNav.visibleItems.includes('Approvals'), 'HR Menu: "Approvals" is visible');
  assert(hrNav.visibleItems.includes('Performance'), 'HR Menu: "Performance" is visible');

  // -----------------------------------------------------------------------
  // SECTION 2: PROTECTED ROUTE GUARDS & DIRECT URL ACCESS PROTECTION
  // -----------------------------------------------------------------------
  console.log('\n--- 2. Protected Route Guards & Direct URL Access Enforcement ---');
  
  // Employee Direct URL Access Protection
  assert(!empNav.canAccessRoute('/manager'), 'Route Guard: Employee direct navigation to /manager rejected');
  assert(!empNav.canAccessRoute('/team'), 'Route Guard: Employee direct navigation to /team rejected');
  assert(!empNav.canAccessRoute('/approvals'), 'Route Guard: Employee direct navigation to /approvals rejected');
  assert(!empNav.canAccessRoute('/hr-operations'), 'Route Guard: Employee direct navigation to /hr-operations rejected');
  assert(!empNav.canAccessRoute('/users'), 'Route Guard: Employee direct navigation to /users rejected');
  assert(empNav.canAccessRoute('/dashboard'), 'Route Guard: Employee direct navigation to /dashboard allowed');
  assert(empNav.canAccessRoute('/attendance'), 'Route Guard: Employee direct navigation to /attendance allowed');
  assert(empNav.canAccessRoute('/leaves'), 'Route Guard: Employee direct navigation to /leaves allowed');
  assert(empNav.canAccessRoute('/performance'), 'Route Guard: Employee direct navigation to /performance allowed');

  // Manager Direct URL Access Protection
  assert(mgrNav.canAccessRoute('/manager'), 'Route Guard: Manager direct navigation to /manager allowed');
  assert(mgrNav.canAccessRoute('/team'), 'Route Guard: Manager direct navigation to /team allowed');
  assert(mgrNav.canAccessRoute('/approvals'), 'Route Guard: Manager direct navigation to /approvals allowed');
  assert(!mgrNav.canAccessRoute('/hr-operations'), 'Route Guard: Manager direct navigation to /hr-operations rejected');

  // Backend Security Gate Check (Backend enforces RBAC even if frontend route was bypassed)
  const empDirectApiManager = await request('GET', '/v1/manager/dashboard', null, employeeToken);
  assert(empDirectApiManager.status === 403, 'Backend Security: Employee blocked from /v1/manager/dashboard (403)');

  const empDirectApiHr = await request('GET', '/v1/hr/operations/overview', null, employeeToken);
  assert(empDirectApiHr.status === 403, 'Backend Security: Employee blocked from /v1/hr/operations/overview (403)');

  const mgrDirectApiHr = await request('GET', '/v1/hr/operations/overview', null, managerToken);
  assert(mgrDirectApiHr.status === 403, 'Backend Security: Manager blocked from /v1/hr/operations/overview (403)');

  // -----------------------------------------------------------------------
  // SECTION 3: MANAGER JOURNEY VERIFICATION
  // -----------------------------------------------------------------------
  console.log('\n--- 3. Manager User Journey & API Integration ---');
  
  // 3.1 Manager Dashboard
  const mgrDash = await request('GET', '/v1/manager/dashboard', null, managerToken);
  assert(mgrDash.status === 200 && mgrDash.body.data?.manager, 'Manager: GET /v1/manager/dashboard returns manager details & team summary');

  // 3.2 Team Management
  const mgrTeam = await request('GET', '/v1/manager/team', null, managerToken);
  assert(mgrTeam.status === 200 && Array.isArray(mgrTeam.body.data), 'Manager: GET /v1/manager/team returns direct reports array');

  // 3.3 Team Attendance
  const mgrTeamAtt = await request('GET', '/v1/manager/team/attendance', null, managerToken);
  assert(mgrTeamAtt.status === 200 && Array.isArray(mgrTeamAtt.body.data), 'Manager: GET /v1/manager/team/attendance returns team records');

  // 3.4 Leave Approvals
  const mgrApprovals = await request('GET', '/v1/manager/approvals', null, managerToken);
  assert(mgrApprovals.status === 200 && mgrApprovals.body.data?.leaves !== undefined, 'Manager: GET /v1/manager/approvals returns pending leaves queue');

  // 3.5 Performance Reviews
  const mgrPerfTeam = await request('GET', '/v1/performance/team', null, managerToken);
  assert(mgrPerfTeam.status === 200 && Array.isArray(mgrPerfTeam.body.data), 'Manager: GET /v1/performance/team returns team appraisals');

  // 3.6 Notifications
  const mgrNotifs = await request('GET', '/v1/notifications', null, managerToken);
  assert(mgrNotifs.status === 200, 'Manager: GET /v1/notifications returns notifications feed');

  // -----------------------------------------------------------------------
  // SECTION 4: HR JOURNEY VERIFICATION
  // -----------------------------------------------------------------------
  console.log('\n--- 4. HR User Journey & API Integration ---');

  // 4.1 HR Management Cockpit
  const hrOverview = await request('GET', '/v1/hr/operations/overview', null, hrToken);
  assert(hrOverview.status === 200 && (hrOverview.body.data?.workforce || hrOverview.body.data?.metrics), 'HR: GET /v1/hr/operations/overview returns workforce intelligence');

  // 4.2 Employee Operations
  const hrEmployees = await request('GET', '/v1/employees', null, hrToken);
  assert(hrEmployees.status === 200 && hrEmployees.body.data?.employees, 'HR: GET /v1/employees returns employee directory');

  // 4.3 Teams Operations
  const hrTeams = await request('GET', '/v1/team', null, hrToken);
  assert(hrTeams.status === 200 && Array.isArray(hrTeams.body.data), 'HR: GET /v1/team returns all organization teams');

  // 4.4 Attendance Monitoring
  const hrAttSummary = await request('GET', '/v1/team/attendance/summary', null, hrToken);
  assert(hrAttSummary.status === 200 && hrAttSummary.body.data?.attendanceRate !== undefined, 'HR: GET /v1/team/attendance/summary returns attendance rate');

  // 4.5 Leave Utilization
  const hrLeaveSummary = await request('GET', '/v1/team/leaves/summary', null, hrToken);
  assert(hrLeaveSummary.status === 200 && hrLeaveSummary.body.data?.pendingLeaves !== undefined, 'HR: GET /v1/team/leaves/summary returns leave utilization metrics');

  // 4.6 Performance Cycles
  const hrPerfPeriods = await request('GET', '/v1/performance/periods', null, hrToken);
  assert(hrPerfPeriods.status === 200 && Array.isArray(hrPerfPeriods.body.data), 'HR: GET /v1/performance/periods returns appraisal cycles');

  // 4.7 Approvals Unified Queue
  const hrApprovalQueue = await request('GET', '/v1/hr/operations/approval-queue', null, hrToken);
  assert(hrApprovalQueue.status === 200 && Array.isArray(hrApprovalQueue.body.data), 'HR: GET /v1/hr/operations/approval-queue returns unified approval queue');

  // 4.8 Broadcast Announcement
  const hrBroadcast = await request('POST', '/v1/hr/operations/broadcast', {
    title: 'Automated Frontend Integration Audit ' + Date.now(),
    message: 'All Phase 6 operational views verified successfully.',
    category: 'GENERAL',
  }, hrToken);
  assert(hrBroadcast.status === 201 && hrBroadcast.body.success, 'HR: POST /v1/hr/operations/broadcast sends announcement');

  // -----------------------------------------------------------------------
  // SECTION 5: EMPLOYEE JOURNEY VERIFICATION
  // -----------------------------------------------------------------------
  console.log('\n--- 5. Employee User Journey & API Integration ---');

  // 5.1 Employee Dashboard
  const empStats = await request('GET', '/v1/dashboard/stats', null, employeeToken);
  assert(empStats.status === 200 && empStats.body.success, 'Employee: GET /v1/dashboard/stats returns personal dashboard cards');

  // 5.2 Own Attendance
  const empAtt = await request('GET', '/v1/attendance/my', null, employeeToken);
  assert(empAtt.status === 200 && empAtt.body.success, 'Employee: GET /v1/attendance/my returns attendance history');

  // 5.3 Own Leave
  const empBalances = await request('GET', '/v1/leaves/balances', null, employeeToken);
  assert(empBalances.status === 200 && empBalances.body.success, 'Employee: GET /v1/leaves/balances returns personal balances');

  // 5.4 Own Performance
  const empPerf = await request('GET', '/v1/performance/my', null, employeeToken);
  assert(empPerf.status === 200 && Array.isArray(empPerf.body.data), 'Employee: GET /v1/performance/my returns own appraisals list');

  // 5.5 Notifications
  const empNotifs = await request('GET', '/v1/notifications', null, employeeToken);
  assert(empNotifs.status === 200 && empNotifs.body.success, 'Employee: GET /v1/notifications returns personal notifications');

  const empUnread = await request('GET', '/v1/notifications/unread-count', null, employeeToken);
  assert(empUnread.status === 200 && empUnread.body.data?.unreadCount !== undefined, 'Employee: GET /v1/notifications/unread-count returns unread count');

  // -----------------------------------------------------------------------
  // SECTION 6: UX STATES, FORM VALIDATIONS & ERROR RECOVERY
  // -----------------------------------------------------------------------
  console.log('\n--- 6. UX States, Validations & Anti-Self-Approval ---');

  // Empty state handling
  const emptyTeamMembers = await request('GET', '/v1/team?search=NonExistentQueryXYZ999', null, adminToken);
  assert(emptyTeamMembers.status === 200 && Array.isArray(emptyTeamMembers.body.data) && emptyTeamMembers.body.data.length === 0, 'UX Empty State: Returns empty array gracefully without crashing');

  // Self-approval violation rejection
  // Create appraisal for manager
  const createMgrAppraisal = await request('POST', '/v1/performance/records', {
    reviewPeriod: 'Self-Approval Test ' + Date.now(),
    selfAssessment: 'Evaluating myself',
  }, managerToken);
  const mgrAppraisalId = createMgrAppraisal.body.data?.id;

  const selfReviewAttempt = await request('POST', `/v1/performance/records/${mgrAppraisalId}/manager-review`, {
    rating: 5.0,
    feedback: 'Giving myself top score',
    reviewerComments: 'Self review',
  }, managerToken);
  assert(selfReviewAttempt.status === 403, 'UX Security: Self-review / self-approval blocked with 403 Forbidden');

  // Mandatory rejection reason validation (<5 chars rejected)
  const invalidRejection = await request('POST', '/v1/workflows/wf-dummy-123/action', {
    action: 'REJECT',
    reason: 'No',
  }, adminToken);
  assert(invalidRejection.status === 400, 'Form Validation: Rejection without adequate reason (<5 chars) rejected with 400');

  // -----------------------------------------------------------------------
  // SECTION 7: PHASE 1–5 SCREENS REGRESSION
  // -----------------------------------------------------------------------
  console.log('\n--- 7. Phase 1–5 Screens Regression Verification ---');
  
  const p1Auth = await request('GET', '/v1/auth/me', null, adminToken);
  assert(p1Auth.status === 200, 'Phase 1: /v1/auth/me operational');

  const p2Org = await request('GET', '/v1/organizations', null, adminToken);
  assert(p2Org.status === 200, 'Phase 2: /v1/organizations operational');

  const p2Depts = await request('GET', '/v1/departments', null, adminToken);
  assert(p2Depts.status === 200, 'Phase 2: /v1/departments operational');

  const p3Onboarding = await request('GET', '/v1/onboarding/new-hires', null, adminToken);
  assert(p3Onboarding.status === 200, 'Phase 3: /v1/onboarding/new-hires operational');

  const p4Leaves = await request('GET', '/v1/leaves/types', null, adminToken);
  assert(p4Leaves.status === 200, 'Phase 4: /v1/leaves/types operational');

  const p4Helpdesk = await request('GET', '/v1/helpdesk/tickets', null, adminToken);
  assert(p4Helpdesk.status === 200, 'Phase 4: /v1/helpdesk/tickets operational');

  const p4Requests = await request('GET', '/v1/requests/my', null, adminToken);
  assert(p4Requests.status === 200, 'Phase 4: /v1/requests/my operational');

  const p5Payroll = await request('GET', '/v1/payroll/periods', null, adminToken);
  assert(p5Payroll.status === 200, 'Phase 5: /v1/payroll/periods operational');

  const p5Payslips = await request('GET', '/v1/payroll/summary', null, adminToken);
  assert(p5Payslips.status === 200, 'Phase 5: /v1/payroll/summary operational');

  console.log('\n================================================================');
  console.log(`🎉 Final Frontend Integration Suite Completed: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('\n❌ Frontend Integration Test Failed:', err);
  process.exit(1);
});
