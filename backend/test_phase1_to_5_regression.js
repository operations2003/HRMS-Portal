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

async function runRegressionTests() {
  console.log('🧪 Starting Full Phase 1–5 APIs Regression Test Suite...\n');

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
    const adminToken = generateToken({
      id: 'user-superadmin-shubham',
      email: 'shubham@tasknera.com',
      roleName: 'Admin',
      orgId: 'org-1',
    });

    const employeeToken = generateToken({
      id: 'user-1789565075726',
      email: 'ajay1@tasknera.com',
      roleName: 'Employee',
      orgId: 'org-1',
    });

    // -----------------------------------------------------------------------
    // PHASE 1 REGRESSION: AUTHENTICATION & USERS
    // -----------------------------------------------------------------------
    console.log('--- Phase 1: Authentication & User Management ---');
    const authMe = await request('GET', '/v1/auth/me', null, adminToken);
    assert(authMe.status === 200 && authMe.body.data?.email === 'shubham@tasknera.com', 'Phase 1: GET /v1/auth/me returns 200 and user profile');

    const usersList = await request('GET', '/v1/users', null, adminToken);
    assert(usersList.status === 200 && (Array.isArray(usersList.body.data) || Array.isArray(usersList.body.data?.users)), 'Phase 1: GET /v1/users returns user list');

    // -----------------------------------------------------------------------
    // PHASE 2 REGRESSION: ORGANIZATIONS, DEPARTMENTS, DESIGNATIONS, EMPLOYEES
    // -----------------------------------------------------------------------
    console.log('\n--- Phase 2: Core Organizational Structure & Employees ---');
    const orgs = await request('GET', '/v1/organizations', null, adminToken);
    assert(orgs.status === 200, 'Phase 2: GET /v1/organizations returns 200');

    const depts = await request('GET', '/v1/departments', null, adminToken);
    assert(depts.status === 200, 'Phase 2: GET /v1/departments returns 200');

    const desigs = await request('GET', '/v1/designations', null, adminToken);
    assert(desigs.status === 200, 'Phase 2: GET /v1/designations returns 200');

    const emps = await request('GET', '/v1/employees', null, adminToken);
    assert(emps.status === 200, 'Phase 2: GET /v1/employees returns 200');

    const metadata = await request('GET', '/v1/employees/metadata', null, adminToken);
    assert(metadata.status === 200 && metadata.body.data?.departments, 'Phase 2: GET /v1/employees/metadata returns form dropdowns');

    const dashboard = await request('GET', '/v1/dashboard/stats', null, adminToken);
    assert(dashboard.status === 200, 'Phase 2: GET /v1/dashboard/stats returns executive stats');

    // -----------------------------------------------------------------------
    // PHASE 3 REGRESSION: ATTENDANCE & ONBOARDING
    // -----------------------------------------------------------------------
    console.log('\n--- Phase 3: Attendance Tracking & Onboarding ---');
    const attMy = await request('GET', '/v1/attendance/my', null, employeeToken);
    assert(attMy.status === 200, 'Phase 3: GET /v1/attendance/my returns employee attendance history');

    const onboarding = await request('GET', '/v1/onboarding/new-hires', null, adminToken);
    assert(onboarding.status === 200, 'Phase 3: GET /v1/onboarding/new-hires returns new hires roster');

    // -----------------------------------------------------------------------
    // PHASE 4 REGRESSION: LEAVES, DOCUMENTS, HELPDESK, REQUESTS, NOTIFICATIONS
    // -----------------------------------------------------------------------
    console.log('\n--- Phase 4: Leaves, Documents, Helpdesk, Requests, Notifications ---');
    const leaveBalances = await request('GET', '/v1/leaves/balances', null, employeeToken);
    assert(leaveBalances.status === 200, 'Phase 4: GET /v1/leaves/balances returns leave balances');

    const leaveTypes = await request('GET', '/v1/leaves/types', null, employeeToken);
    assert(leaveTypes.status === 200 && Array.isArray(leaveTypes.body.data), 'Phase 4: GET /v1/leaves/types returns leave types');

    const docs = await request('GET', '/v1/documents/my', null, employeeToken);
    assert(docs.status === 200, 'Phase 4: GET /v1/documents/my returns employee documents');

    const tickets = await request('GET', '/v1/helpdesk/tickets', null, adminToken);
    assert(tickets.status === 200, 'Phase 4: GET /v1/helpdesk/tickets returns support tickets');

    const myRequests = await request('GET', '/v1/requests/my', null, employeeToken);
    assert(myRequests.status === 200, 'Phase 4: GET /v1/requests/my returns employee service requests');

    const notifs = await request('GET', '/v1/notifications', null, employeeToken);
    assert(notifs.status === 200, 'Phase 4: GET /v1/notifications returns user notification feed');

    // -----------------------------------------------------------------------
    // PHASE 5 REGRESSION: PAYROLL & PAYSLIPS
    // -----------------------------------------------------------------------
    console.log('\n--- Phase 5: Payroll Engine & Payslips ---');
    const payrollPeriods = await request('GET', '/v1/payroll/periods', null, adminToken);
    assert(payrollPeriods.status === 200, 'Phase 5: GET /v1/payroll/periods returns payroll periods');

    const payrollSummary = await request('GET', '/v1/payroll/summary', null, adminToken);
    assert(payrollSummary.status === 200, 'Phase 5: GET /v1/payroll/summary returns payroll executive summary');

    const myPayrollRecords = await request('GET', '/v1/payroll/my/records', null, employeeToken);
    assert(myPayrollRecords.status === 200, 'Phase 5: GET /v1/payroll/my/records returns employee payroll records');

    console.log('\n========================================');
    console.log('Phase 1–5 Regression Tests Completed!');
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log('========================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Regression Suite Crash:', err);
    process.exit(1);
  }
}

runRegressionTests();
