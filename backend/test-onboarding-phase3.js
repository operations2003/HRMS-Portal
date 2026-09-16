import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://127.0.0.1:5000/api';

const runTests = async () => {
  console.log('🧪 Starting Phase 3 Onboarding Backend API Test Suite...\n');
  let passCount = 0;
  let failCount = 0;

  const assert = (condition, title, details = '') => {
    if (condition) {
      console.log(`  ✅ PASS: ${title}`);
      passCount++;
    } else {
      console.error(`  ❌ FAIL: ${title} ${details ? `(${details})` : ''}`);
      failCount++;
    }
  };

  try {
    // 1. Authenticate as Admin & Employee
    console.log('1. Authentication Setup');
    const adminLoginRes = await fetch(`${BASE_URL}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@hrms.local', password: 'Admin@123' }),
    });
    const adminLoginData = await adminLoginRes.json();
    assert(adminLoginRes.status === 200, 'Admin login succeeded');
    const adminToken = adminLoginData.data.token;
    const orgId = adminLoginData.data.user.orgId;

    const empLoginRes = await fetch(`${BASE_URL}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'emp@techcorp.local', password: 'Emp@123' }),
    });
    const empLoginData = await empLoginRes.json();
    assert(empLoginRes.status === 200, 'Employee login succeeded');
    const empToken = empLoginData.data.token;

    // 2. ATS -> HRMS Handoff: Validation Error (400)
    console.log('\n2. ATS -> HRMS Handoff: Validation Handling (400)');
    const badHandoffRes = await fetch(`${BASE_URL}/v1/onboarding/ats-handoff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        orgId,
        firstName: 'TestOnly',
        // missing lastName, email, dateOfJoining, atsCandidateId
      }),
    });
    const badHandoffData = await badHandoffRes.json();
    assert(badHandoffRes.status === 400, 'Incomplete ATS payload rejected with 400 Validation Error');
    assert(badHandoffData.success === false, 'Bad handoff response returns success: false');
    assert(Array.isArray(badHandoffData.errors) && badHandoffData.errors.length >= 3, 'Detailed validation errors returned');

    // 3. ATS -> HRMS Handoff: Successful Ingestion (201)
    console.log('\n3. ATS -> HRMS Handoff: Successful Candidate Ingestion (201)');
    const testCandidateId = `ats_cand_${Date.now()}`;
    const testEmail = `candidate_${Date.now()}@example.com`;
    const joiningDate = '2026-10-01';

    const handoffRes = await fetch(`${BASE_URL}/v1/onboarding/ats-handoff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
        'Idempotency-Key': `idem_${testCandidateId}`,
        'X-Request-Id': `req_${testCandidateId}`,
      },
      body: JSON.stringify({
        orgId,
        atsCandidateId: testCandidateId,
        atsJobId: 'job_senior_fullstack_2026',
        firstName: 'Marcus',
        lastName: 'Vance',
        email: testEmail,
        phone: '+1 555 432 1098',
        dateOfJoining: joiningDate,
        departmentName: 'Engineering',
        designationTitle: 'Senior Software Engineer',
        location: 'San Francisco, CA',
        salary: 145000,
        offerDocuments: [
          {
            title: 'Official Offer Letter - Marcus Vance',
            fileUrl: '/uploads/onboarding_documents/sample_offer.pdf',
            category: 'OFFER',
            documentType: 'OFFER_LETTER',
            fileSize: 245000,
            mimeType: 'application/pdf',
          },
        ],
      }),
    });
    const handoffData = await handoffRes.json();
    assert(handoffRes.status === 201, 'Valid ATS candidate handed off with 201 Created');
    assert(handoffData.success === true, 'Handoff response returns success: true');
    assert(handoffData.data.atsCandidateId === testCandidateId, 'ATS candidate ID matches');
    assert(Array.isArray(handoffData.data.documents) && handoffData.data.documents.length === 1, 'Offer document persisted into Document Vault');
    const newHireId = handoffData.data.id;

    // 4. ATS -> HRMS Handoff: Idempotency Retry Check (200 OK + Header)
    console.log('\n4. ATS -> HRMS Handoff: Idempotency Retry Check');
    const retryHandoffRes = await fetch(`${BASE_URL}/v1/onboarding/ats-handoff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
        'Idempotency-Key': `idem_${testCandidateId}`,
      },
      body: JSON.stringify({
        orgId,
        atsCandidateId: testCandidateId,
        firstName: 'Marcus',
        lastName: 'Vance',
        email: testEmail,
        dateOfJoining: joiningDate,
      }),
    });
    const retryHandoffData = await retryHandoffRes.json();
    assert(retryHandoffRes.status === 200, 'Identical retry returns 200 OK without duplication');
    assert(retryHandoffData.isIdempotent === true, 'isIdempotent flag returned as true');
    assert(retryHandoffRes.headers.get('x-idempotent-replay') === 'true', 'X-Idempotent-Replay header present');
    assert(retryHandoffData.data.id === newHireId, 'Returns identical record ID');

    // 5. ATS -> HRMS Handoff: Duplicate Conflict Check (409)
    console.log('\n5. ATS -> HRMS Handoff: Duplicate Conflict Detection (409)');
    const duplicateEmailRes = await fetch(`${BASE_URL}/v1/onboarding/ats-handoff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        orgId,
        atsCandidateId: `different_ats_${Date.now()}`,
        firstName: 'Imposter',
        lastName: 'User',
        email: 'emp@techcorp.local', // Already registered active employee
        dateOfJoining: '2026-11-01',
      }),
    });
    const duplicateEmailData = await duplicateEmailRes.json();
    assert(duplicateEmailRes.status === 409, 'Conflict with active employee rejected with 409 Duplicate Entry');
    assert(duplicateEmailData.success === false, 'Duplicate response returns success: false');

    // 6. New Hire Listing with Filters
    console.log('\n6. New Hire Listing with Filters (GET /api/v1/onboarding/new-hires)');
    const listRes = await fetch(`${BASE_URL}/v1/onboarding/new-hires?joiningDate=${joiningDate}&status=NOT_STARTED`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const listData = await listRes.json();
    assert(listRes.status === 200, 'Listing endpoint returns 200 OK');
    assert(Array.isArray(listData.data), 'Returns items array');
    const foundCandidate = listData.data.find((nh) => nh.id === newHireId);
    assert(foundCandidate !== undefined, 'Filter returned the newly created candidate');

    // 7. Onboarding Status API
    console.log('\n7. Onboarding Status API (GET /api/v1/onboarding/:id/status)');
    const statusRes = await fetch(`${BASE_URL}/v1/onboarding/${newHireId}/status`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const statusData = await statusRes.json();
    assert(statusRes.status === 200, 'Onboarding status returns 200 OK');
    assert(statusData.data.checklist !== undefined, 'Contains checklist details');
    assert(statusData.data.documentStatus !== undefined, 'Contains document verification stats');
    assert(statusData.data.itSetup !== undefined, 'Contains IT setup readiness');
    assert(statusData.data.bgv !== undefined, 'Contains BGV state');

    // 8. Workflow Checklist Updates
    console.log('\n8. Workflow Checklist API (PATCH /api/v1/onboarding/:id/checklist)');
    const patchChecklistRes = await fetch(`${BASE_URL}/v1/onboarding/${newHireId}/checklist`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        workstationReady: true,
        welcomeKitDispatched: true,
      }),
    });
    const patchChecklistData = await patchChecklistRes.json();
    assert(patchChecklistRes.status === 200, 'Checklist updated with 200 OK');
    assert(patchChecklistData.data.readinessTracker.workstationReady === true, 'workstationReady marked true');
    assert(patchChecklistData.data.readinessTracker.completionPercentage >= 40, 'Completion percentage recalculated');

    // 9. Document Upload & Verification
    console.log('\n9. Document Upload & Verification APIs');
    // Create temporary test file for multipart upload
    const tempFilePath = path.join(process.cwd(), 'temp_test_doc.pdf');
    fs.writeFileSync(tempFilePath, '%PDF-1.4 Mock PDF Content for Onboarding Verification');

    const formData = new FormData();
    const fileBlob = new Blob([fs.readFileSync(tempFilePath)], { type: 'application/pdf' });
    formData.append('file', fileBlob, 'passport_copy.pdf');
    formData.append('category', 'IDENTITY');
    formData.append('documentType', 'PASSPORT');
    formData.append('title', 'Passport Identity Verification');

    const uploadRes = await fetch(`${BASE_URL}/v1/onboarding/${newHireId}/documents/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
      body: formData,
    });
    const uploadData = await uploadRes.json();
    assert(uploadRes.status === 201, 'Document uploaded with 201 Created');
    assert(uploadData.data.verificationStatus === 'PENDING', 'Document initially marked PENDING');
    const uploadedDocId = uploadData.data.id;

    // Clean up temporary local file
    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);

    // Verify document (Approve)
    const verifyDocRes = await fetch(`${BASE_URL}/v1/onboarding/documents/${uploadedDocId}/verify`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        verificationStatus: 'APPROVED',
      }),
    });
    const verifyDocData = await verifyDocRes.json();
    assert(verifyDocRes.status === 200, 'Document approved with 200 OK');
    assert(verifyDocData.data.verificationStatus === 'APPROVED', 'Document status updated to APPROVED');

    // 10. IT Setup Provisioning Status APIs
    console.log('\n10. IT Setup Provisioning Status APIs');
    const getItRes = await fetch(`${BASE_URL}/v1/onboarding/${newHireId}/it-setup`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const getItData = await getItRes.json();
    assert(getItRes.status === 200, 'GET /it-setup returns 200 OK');

    const patchItRes = await fetch(`${BASE_URL}/v1/onboarding/${newHireId}/it-setup`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        workEmail: 'marcus.vance@techcorp.local',
        emailProvisioned: true,
        systemAccess: ['HRMS', 'Slack', 'GitHub', 'AWS-Staging'],
        hardwareAssigned: true,
        assetTag: 'TAG-MBP-9876',
        laptopModel: 'MacBook Pro 16" M3 Max',
        status: 'COMPLETED',
        notes: 'Laptop shipped via FedEx tracking #123456789',
      }),
    });
    const patchItData = await patchItRes.json();
    assert(patchItRes.status === 200, 'PATCH /it-setup returns 200 OK');
    assert(patchItData.data.emailProvisioned === true, 'emailProvisioned marked true');
    assert(patchItData.data.status === 'COMPLETED', 'IT setup status marked COMPLETED');

    // 11. Day-1 Conversion API
    console.log('\n11. Day-1 Conversion API (POST /api/v1/onboarding/:id/convert-to-employee)');
    const convertRes = await fetch(`${BASE_URL}/v1/onboarding/${newHireId}/convert-to-employee`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        salary: 150000,
        employmentType: 'Full-Time',
      }),
    });
    const convertData = await convertRes.json();
    assert(convertRes.status === 200, 'Candidate converted to Employee with 200 OK');
    assert(convertData.data.employeeId !== undefined, 'Linked Employee ID returned');
    assert(convertData.data.employeeCode !== undefined, 'Unique Employee Code assigned');
    assert(convertData.data.newHire.lifecycleState === 'CONVERTED_TO_EMPLOYEE', 'New hire lifecycle state updated to CONVERTED_TO_EMPLOYEE');

    // 12. RBAC Scope Enforcement
    console.log('\n12. RBAC Scope Enforcement');
    const empForbiddenConvertRes = await fetch(`${BASE_URL}/v1/onboarding/${newHireId}/convert-to-employee`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${empToken}`,
      },
      body: JSON.stringify({ salary: 100000 }),
    });
    assert(empForbiddenConvertRes.status === 403, 'Standard employee forbidden from converting new hires (403 Forbidden)');

    console.log(`\n====================================================`);
    console.log(`📊 PHASE 3 ONBOARDING TEST RESULTS: ${passCount} Passed, ${failCount} Failed`);
    console.log(`====================================================\n`);

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test suite encountered an error:', err);
    process.exit(1);
  }
};

runTests();
