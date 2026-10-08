import assert from 'assert';
import { pool } from '../src/config/db.js';
import { exitChecklistService } from '../src/services/exitChecklistService.js';
import { exitChecklistRepository } from '../src/repositories/exitChecklistRepository.js';

console.log('====================================================');
console.log('🧪 Running Exit Checklist RBAC & Lifecycle Test Suite');
console.log('====================================================\n');

let passedTests = 0;
let failedTests = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

async function run() {
  let testOrgId;
  let adminUser, hrUser, emp1User, emp2User;
  let emp1, emp2;
  let testChecklistId;

  try {
    // 1. Setup Test Fixtures: Organization, Users, and Employees
    const orgRes = await pool.query(
      `INSERT INTO organizations (id, name, code, email)
       VALUES ('org-test-exit', 'Exit Test Org', 'ETO', 'exit-test@tasknera.com')
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
       RETURNING id;`
    );
    testOrgId = orgRes.rows[0].id;

    // Users
    adminUser = {
      id: 'usr-admin-exit',
      orgId: testOrgId,
      email: 'admin.exit@test.com',
      roleName: 'Admin',
      permissions: ['exit:admin', 'exit:read', 'exit:write'],
    };

    hrUser = {
      id: 'usr-hr-exit',
      orgId: testOrgId,
      email: 'hr.exit@test.com',
      roleName: 'HR',
      permissions: ['exit:admin', 'exit:read', 'exit:write'],
    };

    emp1User = {
      id: 'usr-emp1-exit',
      orgId: testOrgId,
      email: 'emp1.exit@test.com',
      roleName: 'Employee',
      permissions: ['exit:read', 'exit:write'],
    };

    emp2User = {
      id: 'usr-emp2-exit',
      orgId: testOrgId,
      email: 'emp2.exit@test.com',
      roleName: 'Employee',
      permissions: ['exit:read', 'exit:write'],
    };

    await pool.query(
      `INSERT INTO users (id, org_id, role_id, email, password_hash, first_name, last_name, status)
       VALUES
         ('usr-admin-exit', $1, 'role-admin', 'admin.exit@test.com', 'dummy_hash', 'Admin', 'User', 'Active'),
         ('usr-hr-exit', $1, 'role-hr', 'hr.exit@test.com', 'dummy_hash', 'HR', 'User', 'Active'),
         ('usr-emp1-exit', $1, 'role-employee', 'emp1.exit@test.com', 'dummy_hash', 'Alice', 'Departing', 'Active'),
         ('usr-emp2-exit', $1, 'role-employee', 'emp2.exit@test.com', 'dummy_hash', 'Bob', 'Continuing', 'Active')
       ON CONFLICT (id) DO UPDATE SET org_id = EXCLUDED.org_id, email = EXCLUDED.email;`,
      [testOrgId]
    );

    // Employees
    await pool.query(
      `INSERT INTO employees (id, org_id, user_id, employee_code, first_name, last_name, email, status)
       VALUES 
         ('emp-exit-1', $1, $2, 'EMP-EX-001', 'Alice', 'Departing', $3, 'Active'),
         ('emp-exit-2', $1, $4, 'EMP-EX-002', 'Bob', 'Continuing', $5, 'Active')
       ON CONFLICT (id) DO UPDATE SET status = 'Active', first_name = EXCLUDED.first_name, email = EXCLUDED.email;`,
      [testOrgId, emp1User.id, emp1User.email, emp2User.id, emp2User.email]
    );

    // Clean up any existing test checklists for these employees
    await pool.query(
      `DELETE FROM exit_checklists WHERE employee_id IN ('emp-exit-1', 'emp-exit-2') OR org_id = $1;`,
      [testOrgId]
    );

    // =========================================================================
    // Test 1: Employee CANNOT initiate exit checklist (403 Forbidden)
    // =========================================================================
    await test('Security: Regular employee cannot initiate exit checklist', async () => {
      let threw = false;
      try {
        await exitChecklistService.initiateExitChecklist(emp1User, {
          employeeId: 'emp-exit-1',
          resignationDate: '2026-10-01',
          lastWorkingDay: '2026-10-31',
        });
      } catch (err) {
        threw = true;
        assert.strictEqual(err.statusCode, 403, 'Should return HTTP 403 Forbidden');
        assert(err.message.includes('Only HR and Admin'), 'Error should specify HR/Admin requirement');
      }
      assert(threw, 'Should have thrown 403 Forbidden for Employee initiation attempt');
    });

    // =========================================================================
    // Test 2: HR can initiate exit checklist for an employee
    // =========================================================================
    await test('HR can initiate exit checklist with resignation and last working date', async () => {
      const checklist = await exitChecklistService.initiateExitChecklist(hrUser, {
        employeeId: 'emp-exit-1',
        resignationDate: '2026-10-01',
        lastWorkingDay: '2026-10-31',
        notes: 'Voluntary resignation handover',
      });

      assert(checklist, 'Checklist should be created');
      testChecklistId = checklist.id;
      assert.strictEqual(checklist.employeeId, 'emp-exit-1');
      assert.strictEqual(checklist.status, 'In Progress');
      assert.strictEqual(checklist.resignationDate, '2026-10-01');
      assert.strictEqual(checklist.lastWorkingDay, '2026-10-31');
    });

    // =========================================================================
    // Test 3: Automatically generated 5 mandatory checklist items in Pending status
    // =========================================================================
    await test('Automatically generates the 5 required checklist items in Pending status', async () => {
      const checklist = await exitChecklistRepository.findById(testChecklistId);
      assert.strictEqual(checklist.items.length, 5, 'Must contain exactly 5 items');

      const expectedTitles = [
        'Resignation Approved',
        'Knowledge Transfer Completed',
        'Company Assets Returned',
        'System Access Revoked',
        'Full & Final Settlement Completed',
      ];

      for (let i = 0; i < expectedTitles.length; i++) {
        assert.strictEqual(
          checklist.items[i].title,
          expectedTitles[i],
          `Item ${i + 1} must match exact title`
        );
        assert.strictEqual(
          checklist.items[i].status,
          'Pending',
          `Item ${expectedTitles[i]} must default to Pending`
        );
      }
      assert.strictEqual(checklist.completedItemsCount, 0);
      assert.strictEqual(checklist.isAllItemsCompleted, false);
    });

    // =========================================================================
    // Test 4: Cannot initiate duplicate active exit checklist for same employee
    // =========================================================================
    await test('Duplicate active checklist prevention for same employee', async () => {
      let threw = false;
      try {
        await exitChecklistService.initiateExitChecklist(adminUser, {
          employeeId: 'emp-exit-1',
          resignationDate: '2026-10-02',
          lastWorkingDay: '2026-11-01',
        });
      } catch (err) {
        threw = true;
        assert.strictEqual(err.statusCode, 409, 'Should return HTTP 409 Conflict');
        assert(err.message.includes('already in progress'), 'Error message should explain active checklist');
      }
      assert(threw, 'Should prevent duplicate in-progress checklist');
    });

    // =========================================================================
    // Test 5: Employee Visibility: Respective employee can view own checklist
    // =========================================================================
    await test('Employee Visibility: Respective employee can view their own checklist', async () => {
      const result = await exitChecklistService.getMyExitChecklist(emp1User);
      assert(result.checklist, 'Respective employee should see their checklist');
      assert.strictEqual(result.checklist.id, testChecklistId);
      assert.strictEqual(result.checklist.employeeId, 'emp-exit-1');
      assert.strictEqual(result.checklist.items.length, 5);
    });

    // =========================================================================
    // Test 6: Employee Visibility: Employee without exit process sees null
    // =========================================================================
    await test('Employee Visibility: Employee without exit process sees empty state', async () => {
      const result = await exitChecklistService.getMyExitChecklist(emp2User);
      assert.strictEqual(result.checklist, null, 'Uninitiated employee should have null checklist');
    });

    // =========================================================================
    // Test 7: Employee CANNOT view another employee exit checklist (Security barrier)
    // =========================================================================
    await test('Security: Employee cannot view another employee exit checklist', async () => {
      let threw = false;
      try {
        // Emp2 attempts to query Emp1's checklist by ID
        await exitChecklistService.getExitChecklistById(emp2User, testChecklistId);
      } catch (err) {
        threw = true;
        assert.strictEqual(err.statusCode, 403, 'Must reject with 403 Forbidden');
        assert(err.message.includes('not authorized to view another employee'), 'Error message security');
      }
      assert(threw, 'Should block unauthorized employee inspection of others');
    });

    // =========================================================================
    // Test 8: Employee CANNOT edit checklist items (403 Forbidden)
    // =========================================================================
    await test('Security: Employee cannot mark items as completed', async () => {
      const checklist = await exitChecklistRepository.findById(testChecklistId);
      const firstItemId = checklist.items[0].id;

      let threw = false;
      try {
        await exitChecklistService.updateChecklistItemStatus(emp1User, testChecklistId, firstItemId, {
          status: 'Completed',
        });
      } catch (err) {
        threw = true;
        assert.strictEqual(err.statusCode, 403, 'Must return 403 Forbidden');
      }
      assert(threw, 'Employee must not be able to mark checklist items as completed');
    });

    // =========================================================================
    // Test 9: HR / Admin can mark checklist items as Completed or Pending
    // =========================================================================
    await test('HR & Admin can toggle checklist item status', async () => {
      const checklist = await exitChecklistRepository.findById(testChecklistId);
      const item1 = checklist.items[0];

      // Mark Completed by HR
      const updated1 = await exitChecklistService.updateChecklistItemStatus(hrUser, testChecklistId, item1.id, {
        status: 'Completed',
      });
      assert.strictEqual(updated1.items[0].status, 'Completed');
      assert.strictEqual(updated1.items[0].completedBy, hrUser.id);
      assert(updated1.items[0].completedAt, 'Should record completedAt timestamp');

      // Toggle back to Pending by Admin
      const updated2 = await exitChecklistService.updateChecklistItemStatus(adminUser, testChecklistId, item1.id, {
        status: 'Pending',
      });
      assert.strictEqual(updated2.items[0].status, 'Pending');
      assert.strictEqual(updated2.items[0].completedAt, null);

      // Re-mark Completed
      await exitChecklistService.updateChecklistItemStatus(hrUser, testChecklistId, item1.id, {
        status: 'Completed',
      });
    });

    // =========================================================================
    // Test 10: Rule 8 Enforcement: CANNOT complete exit process if items are pending
    // =========================================================================
    await test('Rule 8: Cannot mark exit process as completed while any checklist item is Pending', async () => {
      let threw = false;
      try {
        // Only 1 item is Completed; 4 items are still Pending!
        await exitChecklistService.completeExitChecklist(hrUser, testChecklistId);
      } catch (err) {
        threw = true;
        assert.strictEqual(err.statusCode, 400, 'Should reject with HTTP 400 Bad Request');
        assert(err.message.includes('All five checklist items must be completed first'), 'Explains Rule 8');
      }
      assert(threw, 'Must block completion when items remain pending');
    });

    // =========================================================================
    // Test 11: Mark remaining 4 items as completed
    // =========================================================================
    await test('Mark all 5 items as Completed', async () => {
      const checklist = await exitChecklistRepository.findById(testChecklistId);
      for (const item of checklist.items) {
        if (item.status !== 'Completed') {
          await exitChecklistService.updateChecklistItemStatus(adminUser, testChecklistId, item.id, {
            status: 'Completed',
          });
        }
      }

      const refreshed = await exitChecklistRepository.findById(testChecklistId);
      assert.strictEqual(refreshed.completedItemsCount, 5);
      assert.strictEqual(refreshed.isAllItemsCompleted, true);
    });

    // =========================================================================
    // Test 12: Rule 8: HR / Admin can complete exit process once all 5 items completed
    // =========================================================================
    await test('Rule 8: HR/Admin can complete exit process when all 5 items are completed', async () => {
      const result = await exitChecklistService.completeExitChecklist(adminUser, testChecklistId);
      assert(result.checklist, 'Returns completed checklist');
      assert.strictEqual(result.checklist.status, 'Completed');
      assert(result.checklist.completedAt, 'Should have completion timestamp');
      assert.strictEqual(result.checklist.completedBy, adminUser.id);

      // Verify employee status updated to Exited
      const empRes = await pool.query(`SELECT status FROM employees WHERE id = 'emp-exit-1';`);
      assert.strictEqual(empRes.rows[0].status, 'Exited', 'Employee status must update to Exited');
    });

    // =========================================================================
    // Test 13: Completed checklist cannot have items modified
    // =========================================================================
    await test('Completed exit checklist items are locked against further modification', async () => {
      const checklist = await exitChecklistRepository.findById(testChecklistId);
      let threw = false;
      try {
        await exitChecklistService.updateChecklistItemStatus(hrUser, testChecklistId, checklist.items[0].id, {
          status: 'Pending',
        });
      } catch (err) {
        threw = true;
        assert.strictEqual(err.statusCode, 400);
        assert(err.message.includes('already been marked as Completed'));
      }
      assert(threw, 'Should prevent modification of finalized checklist');
    });

    // =========================================================================
    // Clean up
    // =========================================================================
    if (testChecklistId) {
      await pool.query(`DELETE FROM exit_checklists WHERE id = $1;`, [testChecklistId]);
    }
    await pool.query(`DELETE FROM employees WHERE id IN ('emp-exit-1', 'emp-exit-2');`);
    await pool.query(`DELETE FROM users WHERE id IN ('usr-admin-exit', 'usr-hr-exit', 'usr-emp1-exit', 'usr-emp2-exit');`);
    if (testOrgId) {
      await pool.query(`DELETE FROM organizations WHERE id = $1;`, [testOrgId]);
    }
  } catch (globalErr) {
    console.error('💥 Test suite setup or execution error:', globalErr);
    failedTests++;
  } finally {
    console.log('\n====================================================');
    console.log(`📊 Test Results: ${passedTests} Passed, ${failedTests} Failed`);
    console.log('====================================================\n');
    await pool.end();
    if (failedTests > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

run();
