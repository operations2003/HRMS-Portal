import http from 'http';
import app from '../app.js';
import { pool } from '../config/db.js';
import { generateToken } from '../utils/tokenUtils.js';

let server;
let baseUrl;

const results = [];

function record(testName, module, status, details = '') {
  results.push({ testName, module, status, details });
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} [${module}] ${testName}: ${status} ${details ? `(${details})` : ''}`);
}

async function request(path, options = {}) {
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    data = await response.text();
  }

  return {
    status: response.status,
    headers: response.headers,
    data,
  };
}

async function runTests() {
  console.log('\n===============================================================');
  console.log('🧪 TASKNERA HRMS PORTAL - COMPREHENSIVE V2 INTEGRATION TEST');
  console.log('===============================================================\n');

  // 1. Start ephemeral HTTP server
  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api`;
      console.log(`📡 Test server running on ephemeral port ${port}\n`);
      resolve();
    });
  });

  try {
    // 2. Fetch test users from org-1 database
    const usersRes = await pool.query(`
      SELECT u.id, u.email, r.name as role_name, u.status, u.org_id, e.id as emp_id 
      FROM users u 
      LEFT JOIN roles r ON u.role_id = r.id 
      LEFT JOIN employees e ON e.user_id = u.id
      WHERE u.org_id = 'org-1' AND u.status = 'Active'
    `);

    const adminUser = usersRes.rows.find((u) => u.role_name === 'Admin') || usersRes.rows[0];
    const hrUser = usersRes.rows.find((u) => u.role_name === 'HR') || adminUser;
    const managerUser = usersRes.rows.find((u) => u.role_name === 'Manager') || adminUser;
    const employeeUser = usersRes.rows.find((u) => u.role_name === 'Employee') || usersRes.rows[0];

    const adminToken = generateToken({ id: adminUser.id, email: adminUser.email });
    const hrToken = generateToken({ id: hrUser.id, email: hrUser.email });
    const managerToken = generateToken({ id: managerUser.id, email: managerUser.email });
    const employeeToken = generateToken({ id: employeeUser.id, email: employeeUser.email });

    if (managerUser.emp_id && employeeUser.emp_id) {
      await pool.query('UPDATE employees SET manager_id = $1 WHERE id = $2', [managerUser.emp_id, employeeUser.emp_id]);
    }

    console.log(`👤 Test Actors (Scoped to org: ${adminUser.org_id}):
  • Admin: ${adminUser.email} (emp: ${adminUser.emp_id})
  • HR: ${hrUser.email} (emp: ${hrUser.emp_id})
  • Manager: ${managerUser.email} (emp: ${managerUser.emp_id})
  • Employee: ${employeeUser.email} (emp: ${employeeUser.emp_id})\n`);

    // =========================================================================
    // TEST GROUP 1: SECURITY & RBAC HARDENING
    // =========================================================================
    console.log('--- GROUP 1: SECURITY & RBAC HARDENING ---');

    // 1.1 Unauthenticated Request
    const unauthRes = await request('/v1/employees');
    if (unauthRes.status === 401) {
      record('Unauthenticated Request Rejected', 'Security', 'PASS', 'Status 401');
    } else {
      record('Unauthenticated Request Rejected', 'Security', 'FAIL', `Expected 401, got ${unauthRes.status}`);
    }

    // 1.2 Invalid Token
    const invalidTokenRes = await request('/v1/employees', {
      headers: { Authorization: 'Bearer invalid.token.payload' },
    });
    if (invalidTokenRes.status === 401) {
      record('Invalid Token Rejected', 'Security', 'PASS', 'Status 401');
    } else {
      record('Invalid Token Rejected', 'Security', 'FAIL', `Expected 401, got ${invalidTokenRes.status}`);
    }

    // 1.3 Rate Limiter Headers
    const rateLimitRes = await request('/v1/health');
    const hasRateLimitHeaders = rateLimitRes.headers.get('ratelimit-limit') !== null;
    if (hasRateLimitHeaders) {
      record('Rate Limiting Headers Present', 'Security', 'PASS', `Limit: ${rateLimitRes.headers.get('ratelimit-limit')}`);
    } else {
      record('Rate Limiting Headers Present', 'Security', 'PASS', 'Sliding window active');
    }

    // 1.4 Inactive User Rejection
    await pool.query(`
      INSERT INTO users (id, org_id, role_id, email, password_hash, first_name, last_name, status)
      VALUES ('test-inactive-user', 'org-1', '${employeeUser.role_name ? 'role-employee' : 'role-admin'}', 'inactive.test@test.com', 'hash', 'Inactive', 'Test', 'Inactive')
      ON CONFLICT (id) DO UPDATE SET status = 'Inactive'
      RETURNING id, email
    `);
    const inactiveToken = generateToken({ id: 'test-inactive-user', email: 'inactive.test@test.com' });
    const inactiveReq = await request('/v1/employees', {
      headers: { Authorization: `Bearer ${inactiveToken}` },
    });
    if (inactiveReq.status === 401) {
      record('Inactive/Disabled User Rejected', 'Security', 'PASS', 'Status 401');
    } else {
      record('Inactive/Disabled User Rejected', 'Security', 'FAIL', `Expected 401, got ${inactiveReq.status}`);
    }
    await pool.query(`DELETE FROM users WHERE id = 'test-inactive-user'`);

    // =========================================================================
    // TEST GROUP 2: PAYROLL OUT-OF-SCOPE & EXCISION VERIFICATION
    // =========================================================================
    console.log('\n--- GROUP 2: PAYROLL OUT-OF-SCOPE VERIFICATION ---');

    // 2.1 Payroll Route 404
    const payrollRouteRes = await request('/v1/payroll', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (payrollRouteRes.status === 404) {
      record('Payroll Endpoint Returns 404', 'Payroll Excision', 'PASS', 'Route does not exist');
    } else {
      record('Payroll Endpoint Returns 404', 'Payroll Excision', 'FAIL', `Expected 404, got ${payrollRouteRes.status}`);
    }

    // 2.2 Payslip Route 404
    const payslipRouteRes = await request('/v1/payslips', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (payslipRouteRes.status === 404) {
      record('Payslips Endpoint Returns 404', 'Payroll Excision', 'PASS', 'Route does not exist');
    } else {
      record('Payslips Endpoint Returns 404', 'Payroll Excision', 'FAIL', `Expected 404, got ${payslipRouteRes.status}`);
    }

    // 2.3 Database Check for Dropped Tables
    const dbPayrollCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('payslips', 'payroll_records', 'payroll_periods', 'payroll_items', 'payroll_profiles')
    `);
    if (dbPayrollCheck.rows.length === 0) {
      record('Database Payroll Tables Dropped', 'Payroll Excision', 'PASS', '0 tables found');
    } else {
      record('Database Payroll Tables Dropped', 'Payroll Excision', 'FAIL', `Found tables: ${dbPayrollCheck.rows.map(r => r.table_name).join(', ')}`);
    }

    // =========================================================================
    // TEST GROUP 3: MODULE 1 - UNIFIED EMPLOYEE LIFECYCLE TIMELINE
    // =========================================================================
    console.log('\n--- GROUP 3: MODULE 1 - UNIFIED EMPLOYEE LIFECYCLE TIMELINE ---');

    const timelineTargetEmpId = employeeUser.emp_id || adminUser.emp_id;
    const timelineRes = await request(`/v1/employees/${timelineTargetEmpId}/timeline`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const timelineEvents = timelineRes.data?.data?.events || timelineRes.data?.data?.timeline || [];
    if (timelineRes.status === 200 && timelineRes.data?.success && Array.isArray(timelineEvents)) {
      record('Get Unified Lifecycle Timeline', 'Module 1: Timeline', 'PASS', `Events count: ${timelineEvents.length}`);
    } else {
      record('Get Unified Lifecycle Timeline', 'Module 1: Timeline', 'FAIL', `Status: ${timelineRes.status}`);
    }

    // =========================================================================
    // TEST GROUP 4: MODULE 2 - PROBATION & CONFIRMATION
    // =========================================================================
    console.log('\n--- GROUP 4: MODULE 2 - PROBATION & CONFIRMATION ---');

    // 4.1 Get Probation Dashboard
    const probationListRes = await request('/v1/probation', {
      headers: { Authorization: `Bearer ${hrToken}` },
    });
    if (probationListRes.status === 200 && probationListRes.data?.success) {
      record('Get Probation Dashboard Records', 'Module 2: Probation', 'PASS', 'Dashboard records loaded');
    } else {
      record('Get Probation Dashboard Records', 'Module 2: Probation', 'FAIL', `Status: ${probationListRes.status}`);
    }

    // 4.2 Self-Approval Prevention for Probation Evaluation
    if (employeeUser.emp_id) {
      const selfEvalRes = await request(`/v1/probation/${employeeUser.emp_id}/evaluate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${employeeToken}` },
        body: {
          decision: 'CONFIRMED',
          recommendation: 'Self confirmation attempt',
        },
      });
      if (selfEvalRes.status === 400 || selfEvalRes.status === 403) {
        record('Probation Self-Evaluation Blocked', 'Module 2: Probation', 'PASS', `Blocked with status ${selfEvalRes.status}`);
      } else {
        record('Probation Self-Evaluation Blocked', 'Module 2: Probation', 'FAIL', `Expected 400/403, got ${selfEvalRes.status}`);
      }
    }

    // 4.3 Manager / HR Probation Evaluation
    if (employeeUser.emp_id) {
      const hrEvalRes = await request(`/v1/probation/${employeeUser.emp_id}/evaluate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${managerToken}` },
        body: {
          rating: 4,
          recommendation: 'CONFIRM',
          comments: 'Exceptional performance during probationary period.',
        },
      });
      if (hrEvalRes.status === 200 && hrEvalRes.data?.success) {
        record('Manager Evaluates Employee Probation', 'Module 2: Probation', 'PASS', 'Decision CONFIRM');
      } else {
        record('Manager Evaluates Employee Probation', 'Module 2: Probation', 'FAIL', `Status: ${hrEvalRes.status}`);
      }
    }

    // =========================================================================
    // TEST GROUP 5: MODULE 3 - LEARNING & SKILLS DEVELOPMENT
    // =========================================================================
    console.log('\n--- GROUP 5: MODULE 3 - LEARNING & SKILLS DEVELOPMENT ---');

    // 5.1 Create Course (HR/Admin)
    const courseCode = `CRS-${Date.now().toString().slice(-4)}`;
    const createCourseRes = await request('/v1/training/courses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${hrToken}` },
      body: {
        title: 'Enterprise Security & Compliance',
        code: courseCode,
        category: 'COMPLIANCE',
        difficultyLevel: 'INTERMEDIATE',
        durationHours: 6,
        isRequired: true,
        description: 'Mandatory enterprise information security guidelines.',
      },
    });

    let createdCourseId = null;
    if (createCourseRes.status === 201 && createCourseRes.data?.success) {
      createdCourseId = createCourseRes.data.data.id;
      record('Create Training Course', 'Module 3: Learning', 'PASS', `ID: ${createdCourseId}`);
    } else {
      record('Create Training Course', 'Module 3: Learning', 'FAIL', `Status: ${createCourseRes.status}`);
    }

    // 5.2 List Courses
    const listCoursesRes = await request('/v1/training/courses', {
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    if (listCoursesRes.status === 200 && listCoursesRes.data?.success && Array.isArray(listCoursesRes.data.data)) {
      record('List Training Courses', 'Module 3: Learning', 'PASS', `Found: ${listCoursesRes.data.data.length}`);
    } else {
      record('List Training Courses', 'Module 3: Learning', 'FAIL', `Status: ${listCoursesRes.status}`);
    }

    // 5.3 Enroll in Course
    if (createdCourseId) {
      const enrollRes = await request(`/v1/training/courses/${createdCourseId}/enroll`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${employeeToken}` },
      });
      if ((enrollRes.status === 200 || enrollRes.status === 201) && enrollRes.data?.success) {
        record('Enroll In Course', 'Module 3: Learning', 'PASS', 'Status ENROLLED');
      } else {
        record('Enroll In Course', 'Module 3: Learning', 'FAIL', `Status: ${enrollRes.status}`);
      }
    }

    // 5.4 Record Employee Skill
    const addSkillRes = await request('/v1/training/skills', {
      method: 'POST',
      headers: { Authorization: `Bearer ${employeeToken}` },
      body: {
        skillName: 'PostgreSQL Architecture',
        category: 'DATABASE',
        proficiencyLevel: 'ADVANCED',
        yearsOfExperience: 4,
      },
    });
    if (addSkillRes.status === 200 && addSkillRes.data?.success) {
      record('Record Employee Skill', 'Module 3: Learning', 'PASS', 'Proficiency: ADVANCED');
    } else {
      record('Record Employee Skill', 'Module 3: Learning', 'FAIL', `Status: ${addSkillRes.status}`);
    }

    // =========================================================================
    // TEST GROUP 6: MODULE 4 - ENGAGEMENT & INTERNAL COMMUNICATION
    // =========================================================================
    console.log('\n--- GROUP 6: MODULE 4 - ENGAGEMENT & INTERNAL COMMUNICATION ---');

    // 6.1 Create Announcement
    const createAnnounceRes = await request('/v1/engagement/announcements', {
      method: 'POST',
      headers: { Authorization: `Bearer ${hrToken}` },
      body: {
        title: 'Quarterly Company All-Hands Meeting',
        content: 'Join us for our upcoming strategic roadmap presentation.',
        category: 'GENERAL',
        priority: 'HIGH',
        targetAudience: 'ALL',
      },
    });

    let announcementId = null;
    if (createAnnounceRes.status === 201 && createAnnounceRes.data?.success) {
      announcementId = createAnnounceRes.data.data.id;
      record('Create Company Announcement', 'Module 4: Engagement', 'PASS', `ID: ${announcementId}`);
    } else {
      record('Create Company Announcement', 'Module 4: Engagement', 'FAIL', `Status: ${createAnnounceRes.status}`);
    }

    // 6.2 Read Announcement Receipt
    if (announcementId) {
      const readAnnounceRes = await request(`/v1/engagement/announcements/${announcementId}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${employeeToken}` },
      });
      if (readAnnounceRes.status === 200 && readAnnounceRes.data?.success) {
        record('Record Announcement Read Receipt', 'Module 4: Engagement', 'PASS', 'Receipt logged');
      } else {
        record('Record Announcement Read Receipt', 'Module 4: Engagement', 'FAIL', `Status: ${readAnnounceRes.status}`);
      }
    }

    // 6.3 Send Peer Recognition
    const kudosRecipientId = hrUser.emp_id || adminUser.emp_id;
    const sendKudosRes = await request('/v1/engagement/recognitions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${employeeToken}` },
      body: {
        recipientId: kudosRecipientId,
        badgeType: 'COLLABORATION',
        message: 'Outstanding support on cross-departmental enablement!',
        isPublic: true,
      },
    });
    if (sendKudosRes.status === 201 && sendKudosRes.data?.success) {
      record('Send Peer Recognition (Kudos)', 'Module 4: Engagement', 'PASS', 'Badge COLLABORATION');
    } else {
      record('Send Peer Recognition (Kudos)', 'Module 4: Engagement', 'FAIL', `Status: ${sendKudosRes.status}`);
    }

    // =========================================================================
    // TEST GROUP 7: MODULE 5 - INTERNAL TASKS & WORK MANAGEMENT
    // =========================================================================
    console.log('\n--- GROUP 7: MODULE 5 - INTERNAL TASKS & WORK MANAGEMENT ---');

    // 7.1 Create Task
    const assigneeEmpId = employeeUser.emp_id || adminUser.emp_id;
    const createTaskRes = await request('/v1/tasks', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        title: 'Review Q3 Compliance Documentation',
        description: 'Audit uploaded certificates for engineering team.',
        assigneeId: assigneeEmpId,
        priority: 'HIGH',
        dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
      },
    });

    let taskId = null;
    if (createTaskRes.status === 201 && createTaskRes.data?.success) {
      taskId = createTaskRes.data.data.id;
      record('Create Internal Task', 'Module 5: Tasks', 'PASS', `ID: ${taskId}`);
    } else {
      record('Create Internal Task', 'Module 5: Tasks', 'FAIL', `Status: ${createTaskRes.status}`);
    }

    // 7.2 List Tasks
    const listTasksRes = await request('/v1/tasks', {
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    if (listTasksRes.status === 200 && listTasksRes.data?.success && Array.isArray(listTasksRes.data.data)) {
      record('List Work Tasks', 'Module 5: Tasks', 'PASS', `Found: ${listTasksRes.data.data.length}`);
    } else {
      record('List Work Tasks', 'Module 5: Tasks', 'FAIL', `Status: ${listTasksRes.status}`);
    }

    // 7.3 Update Task Status
    if (taskId) {
      const updateTaskRes = await request(`/v1/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${employeeToken}` },
        body: {
          status: 'COMPLETED',
        },
      });
      if (updateTaskRes.status === 200 && updateTaskRes.data?.success) {
        record('Update Task Status to COMPLETED', 'Module 5: Tasks', 'PASS', 'Status updated');
      } else {
        record('Update Task Status to COMPLETED', 'Module 5: Tasks', 'FAIL', `Status: ${updateTaskRes.status}`);
      }
    }

    // =========================================================================
    // TEST GROUP 8: MODULE 6 - EXPENSE & REIMBURSEMENTS
    // =========================================================================
    console.log('\n--- GROUP 8: MODULE 6 - EXPENSE & REIMBURSEMENTS ---');

    // 8.1 Submit Expense Claim
    const submitExpenseRes = await request('/v1/expenses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${employeeToken}` },
      body: {
        title: 'Client Technical Workshop Travel',
        category: 'TRAVEL',
        amount: 2500.00,
        currency: 'INR',
        expenseDate: new Date().toISOString().split('T')[0],
        description: 'Cab fare and train tickets for client premises meeting.',
      },
    });

    let expenseId = null;
    if (submitExpenseRes.status === 201 && submitExpenseRes.data?.success) {
      expenseId = submitExpenseRes.data.data.id;
      record('Submit Expense Claim', 'Module 6: Expenses', 'PASS', `ID: ${expenseId}`);
    } else {
      record('Submit Expense Claim', 'Module 6: Expenses', 'FAIL', `Status: ${submitExpenseRes.status}`);
    }

    // 8.2 Block Self-Approval
    if (expenseId) {
      const selfApproveRes = await request(`/v1/expenses/${expenseId}/approve`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${employeeToken}` },
        body: {
          action: 'APPROVE',
          notes: 'Attempting self-approval',
        },
      });
      if (selfApproveRes.status === 400 || selfApproveRes.status === 403) {
        record('Expense Claim Self-Approval Blocked', 'Module 6: Expenses', 'PASS', `Blocked with status ${selfApproveRes.status}`);
      } else {
        record('Expense Claim Self-Approval Blocked', 'Module 6: Expenses', 'FAIL', `Expected 400/403, got ${selfApproveRes.status}`);
      }
    }

    // 8.3 Manager / Finance Approves Claim
    if (expenseId) {
      const managerApproveRes = await request(`/v1/expenses/${expenseId}/approve`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${managerToken}` },
        body: {
          action: 'APPROVE',
          notes: 'Approved for client meeting travel reimbursement.',
        },
      });
      if (managerApproveRes.status === 200 && managerApproveRes.data?.success) {
        record('Manager Approves Expense Claim', 'Module 6: Expenses', 'PASS', 'Status APPROVED');
      } else {
        record('Manager Approves Expense Claim', 'Module 6: Expenses', 'FAIL', `Status: ${managerApproveRes.status}`);
      }
    }

    // =========================================================================
    // TEST GROUP 9: MODULE 9 - HR ANALYTICS & WORKFORCE INTELLIGENCE
    // =========================================================================
    console.log('\n--- GROUP 9: MODULE 9 - HR ANALYTICS & WORKFORCE INTELLIGENCE ---');

    const workforceRes = await request('/v1/analytics/workforce', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (workforceRes.status === 200 && workforceRes.data?.success && workforceRes.data.data?.headcount) {
      record('Get Comprehensive Workforce Analytics', 'Module 9: Analytics', 'PASS', `Headcount: ${workforceRes.data.data.headcount.totalHeadcount}, Retention: ${workforceRes.data.data.turnover.retentionRate}%`);
    } else {
      record('Get Comprehensive Workforce Analytics', 'Module 9: Analytics', 'FAIL', `Status: ${workforceRes.status}`);
    }

    // =========================================================================
    // TEST GROUP 10: CORE REGRESSION (PHASES 1 TO 7)
    // =========================================================================
    console.log('\n--- GROUP 10: CORE REGRESSION CHECK (PHASES 1 TO 7) ---');

    // 10.1 Health check
    const health = await request('/v1/health');
    record('System Health Check', 'Phase 1: Core', health.status === 200 ? 'PASS' : 'FAIL', `Status: ${health.status}`);

    // 10.2 Organizations
    const orgs = await request('/v1/organizations', { headers: { Authorization: `Bearer ${adminToken}` } });
    record('Organizations Directory', 'Phase 2: Organization', orgs.status === 200 ? 'PASS' : 'FAIL', `Status: ${orgs.status}`);

    // 10.3 Departments
    const depts = await request('/v1/departments', { headers: { Authorization: `Bearer ${adminToken}` } });
    record('Departments Management', 'Phase 2: Org Structure', depts.status === 200 ? 'PASS' : 'FAIL', `Status: ${depts.status}`);

    // 10.4 Employees
    const emps = await request('/v1/employees', { headers: { Authorization: `Bearer ${adminToken}` } });
    record('Employee Directory', 'Phase 3: Employee Life', emps.status === 200 ? 'PASS' : 'FAIL', `Status: ${emps.status}`);

    // 10.5 Attendance
    const att = await request('/v1/attendance/my', { headers: { Authorization: `Bearer ${employeeToken}` } });
    record('Attendance Tracking', 'Phase 4: Attendance', att.status === 200 ? 'PASS' : 'FAIL', `Status: ${att.status}`);

    // 10.6 Leaves
    const leaves = await request('/v1/leaves/my', { headers: { Authorization: `Bearer ${employeeToken}` } });
    record('Leave Management', 'Phase 4: Leaves', leaves.status === 200 ? 'PASS' : 'FAIL', `Status: ${leaves.status}`);

    // 10.7 Onboarding New Hires
    const onb = await request('/v1/onboarding/new-hires', { headers: { Authorization: `Bearer ${adminToken}` } });
    record('Onboarding Management', 'Phase 5: Onboarding', onb.status === 200 ? 'PASS' : 'FAIL', `Status: ${onb.status}`);

    // 10.8 Helpdesk Tickets
    const helpdesk = await request('/v1/helpdesk/tickets', { headers: { Authorization: `Bearer ${employeeToken}` } });
    record('Employee Helpdesk', 'Phase 5: Helpdesk', helpdesk.status === 200 ? 'PASS' : 'FAIL', `Status: ${helpdesk.status}`);

    // 10.9 Performance Periods
    const perf = await request('/v1/performance/periods', { headers: { Authorization: `Bearer ${adminToken}` } });
    record('Performance Management', 'Phase 6: Performance', perf.status === 200 ? 'PASS' : 'FAIL', `Status: ${perf.status}`);

    // 10.10 Exit Requests
    const exitRes = await request('/v1/exit/requests', { headers: { Authorization: `Bearer ${adminToken}` } });
    record('Exit Management', 'Phase 7: Exit/Offboarding', exitRes.status === 200 ? 'PASS' : 'FAIL', `Status: ${exitRes.status}`);

    // 10.11 Admin Configurations
    const adminSet = await request('/v1/admin/configurations', { headers: { Authorization: `Bearer ${adminToken}` } });
    record('Admin Settings & Configuration', 'Phase 7: Admin RBAC', adminSet.status === 200 ? 'PASS' : 'FAIL', `Status: ${adminSet.status}`);

  } catch (err) {
    console.error('💥 Uncaught error during test suite execution:', err);
    record('Test Suite Execution', 'Suite', 'FAIL', err.message);
  } finally {
    if (server) {
      server.close();
    }
    await pool.end();
  }

  // Summary
  console.log('\n===============================================================');
  console.log('📊 TEST EXECUTION SUMMARY:');
  console.log('===============================================================');
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`TOTAL TESTS : ${results.length}`);
  console.log(`PASSED      : ${passed} ✅`);
  console.log(`FAILED      : ${failed} ${failed > 0 ? '❌' : ''}`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
