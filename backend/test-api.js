/**
 * API & RBAC Test Suite for HRMS Backend
 */

const BASE_URL = 'http://127.0.0.1:5000/api';

const runTests = async () => {
  console.log('🧪 Starting HRMS Backend Test Suite...\n');
  let passCount = 0;
  let failCount = 0;

  const assert = (condition, title) => {
    if (condition) {
      console.log(`  ✅ PASS: ${title}`);
      passCount++;
    } else {
      console.error(`  ❌ FAIL: ${title}`);
      failCount++;
    }
  };

  try {
    // 1. Health Check
    console.log('1. Health Check');
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200, 'Health endpoint responds with 200');
    assert(healthData.success === true, 'Health check returns success: true');

    // 2. Authentication: Invalid Login
    console.log('\n2. Authentication - Invalid Credentials');
    const badLoginRes = await fetch(`${BASE_URL}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@hrms.local', password: 'WrongPassword' }),
    });
    const badLoginData = await badLoginRes.json();
    assert(badLoginRes.status === 401, 'Invalid login rejected with 401');
    assert(badLoginData.success === false, 'Error response format matched');

    // 3. Authentication: Valid Login (SuperAdmin)
    console.log('\n3. Authentication - SuperAdmin Login');
    const adminLoginRes = await fetch(`${BASE_URL}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@hrms.local', password: 'Admin@123' }),
    });
    const adminLoginData = await adminLoginRes.json();
    assert(adminLoginRes.status === 200, 'Admin login succeeded with 200');
    assert(adminLoginData.data.token !== undefined, 'JWT token returned');
    assert(adminLoginData.data.user.roleName === 'SuperAdmin', 'Role is SuperAdmin');
    const adminToken = adminLoginData.data.token;

    // 4. Authenticated Profile: GET /api/v1/auth/me
    console.log('\n4. Authenticated Profile');
    const meRes = await fetch(`${BASE_URL}/v1/auth/me`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const meData = await meRes.json();
    assert(meRes.status === 200, 'Auth profile responds with 200');
    assert(meData.data.email === 'admin@hrms.local', 'Profile matches logged-in user');

    // 5. RBAC Enforcement: Standard Employee Access Restriction
    console.log('\n5. RBAC Enforcement');
    const empLoginRes = await fetch(`${BASE_URL}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'emp@techcorp.local', password: 'Emp@123' }),
    });
    const empLoginData = await empLoginRes.json();
    const empToken = empLoginData.data.token;

    // Employee tries to create an Organization (requires org:write)
    const forbiddenRes = await fetch(`${BASE_URL}/v1/organizations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${empToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Hacker Corp',
        code: 'HACK',
        email: 'hack@test.com',
      }),
    });
    const forbiddenData = await forbiddenRes.json();
    assert(forbiddenRes.status === 403, 'Employee denied organization creation with 403 Forbidden');
    assert(forbiddenData.success === false, 'RBAC error returned in standard format');

    // 6. Organization Management (CRUD)
    console.log('\n6. Organization Management');
    const createOrgRes = await fetch(`${BASE_URL}/v1/organizations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Quantum Dynamics Ltd',
        code: 'QDYN',
        email: 'contact@quantumdynamics.io',
        phone: '+1 555 777 8888',
        website: 'https://quantumdynamics.io',
        address: '742 Evergreen Terrace, Springfield',
        status: 'Active',
      }),
    });
    const createOrgData = await createOrgRes.json();
    assert(createOrgRes.status === 201, 'Organization created with 201 Created');
    assert(createOrgData.data.code === 'QDYN', 'Organization code stored correctly');
    const newOrgId = createOrgData.data.id;

    // List Organizations
    const listOrgsRes = await fetch(`${BASE_URL}/v1/organizations?search=Quantum`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const listOrgsData = await listOrgsRes.json();
    assert(listOrgsRes.status === 200, 'Organizations listed with 200');
    assert(listOrgsData.data.length >= 1, 'Search filter returned the created organization');

    // 7. Employee Management (CRUD)
    console.log('\n7. Employee Management');
    const createEmpRes = await fetch(`${BASE_URL}/v1/employees`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orgId: newOrgId,
        firstName: 'Alexander',
        lastName: 'Pierce',
        email: 'a.pierce@quantumdynamics.io',
        phone: '+1 555 999 0000',
        employeeCode: 'EMP-900',
        employmentType: 'Full-Time',
        status: 'Active',
        salary: 120000,
      }),
    });
    const createEmpData = await createEmpRes.json();
    assert(createEmpRes.status === 201, 'Employee created with 201 Created');
    assert(createEmpData.data.email === 'a.pierce@quantumdynamics.io', 'Employee email verified');
    const newEmpId = createEmpData.data.id;

    // Employee list with pagination & filters
    const listEmpRes = await fetch(`${BASE_URL}/v1/employees?search=Alexander`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const listEmpData = await listEmpRes.json();
    assert(listEmpRes.status === 200, 'Employee search works');
    assert(listEmpData.data.employees.length === 1, 'Found created employee in list');

    // Employee Update
    const updateEmpRes = await fetch(`${BASE_URL}/v1/employees/${newEmpId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'On Leave',
        salary: 135000,
      }),
    });
    const updateEmpData = await updateEmpRes.json();
    assert(updateEmpRes.status === 200, 'Employee updated successfully');
    assert(updateEmpData.data.status === 'On Leave', 'Status successfully updated to On Leave');

    // 8. Dashboard Statistics
    console.log('\n8. Dashboard Statistics');
    const dashRes = await fetch(`${BASE_URL}/v1/dashboard/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const dashData = await dashRes.json();
    assert(dashRes.status === 200, 'Dashboard stats retrieved with 200');
    assert(dashData.data.totalOrganizations >= 4, 'Stats reflects total organizations');
    assert(dashData.data.totalEmployees >= 6, 'Stats reflects total employees');

    console.log(`\n========================================`);
    console.log(`📊 TEST RESULTS: ${passCount} Passed, ${failCount} Failed`);
    console.log(`========================================\n`);

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test suite encountered an error:', err);
    process.exit(1);
  }
};

runTests();
