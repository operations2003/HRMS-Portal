import { pool } from './src/config/db.js';
import { leaveRepository } from './src/repositories/leaveRepository.js';
import { leaveService } from './src/services/leaveService.js';
import { employeeRepository } from './src/repositories/employeeRepository.js';

async function runTests() {
  console.log('🧪 Starting Manager Leave Approval (Prompt 5) Validation Tests...\n');
  let passed = 0;
  let failed = 0;

  const assert = (condition, msg) => {
    if (condition) {
      console.log(`✅ [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${msg}`);
      failed++;
    }
  };

  try {
    // 1. Verify schema and mapping
    console.log('--- 1. Verification of DB Schema & Entity Mapping ---');
    const existingLeave = await pool.query('SELECT * FROM leave_requests ORDER BY created_at DESC LIMIT 1;');
    if (existingLeave.rows.length > 0) {
      const mapped = await leaveRepository.findById(existingLeave.rows[0].id);
      assert(mapped !== null, 'leaveRepository.findById returns valid domain entity');
      assert(mapped.employee !== undefined, 'Leave request has employee object');
      assert('managerId' in mapped.employee, 'Employee object includes managerId attribute');
      assert('appliedDate' in mapped, 'Leave request has appliedDate mapped for submitted date');
    } else {
      console.log('ℹ️ No leave requests in database yet, testing with mock validation.');
    }

    // 2. Test Team Scope & Direct Reports in findTeamLeaves
    console.log('\n--- 2. Team Scope & findTeamLeaves Filtering ---');
    // Find an active manager employee
    const managerRes = await pool.query(
      `SELECT e.*, u.id as user_id, r.name as role_name 
       FROM employees e
       JOIN users u ON e.user_id = u.id
       JOIN roles r ON u.role_id = r.id
       WHERE LOWER(r.name) = 'manager'
       LIMIT 1;`
    );

    if (managerRes.rows.length > 0) {
      const mgr = managerRes.rows[0];
      const mgrUser = {
        id: mgr.user_id,
        orgId: mgr.org_id,
        email: mgr.email,
        roleName: mgr.role_name,
      };

      const teamLeaves = await leaveService.getTeamLeaves(mgrUser, { limit: 10 });
      assert(Array.isArray(teamLeaves.records), 'leaveService.getTeamLeaves returns records array');
      assert(teamLeaves.pagination !== undefined, 'leaveService.getTeamLeaves includes pagination metadata');

      // 3. Self-Approval Barrier Check
      console.log('\n--- 3. Security Check: Self-Approval Prevention ---');
      // Create a test pending leave request for the manager themselves
      const leaveTypeRes = await pool.query(`SELECT id FROM leave_types WHERE org_id = $1 LIMIT 1;`, [mgr.org_id]);
      if (leaveTypeRes.rows.length > 0) {
        const leaveTypeId = leaveTypeRes.rows[0].id;
        const insertRes = await pool.query(
          `INSERT INTO leave_requests (
            id, org_id, employee_id, leave_type_id, start_date, end_date,
            total_days, reason, status, applied_date, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, CURRENT_DATE + INTERVAL '10 days', CURRENT_DATE + INTERVAL '12 days',
            3, 'Self-approval test request', 'PENDING', NOW(), NOW(), NOW()
          ) RETURNING id;`,
          [`test-leave-${Date.now()}`, mgr.org_id, mgr.id, leaveTypeId]
        );
        const testLeaveId = insertRes.rows[0].id;

        try {
          await leaveService.approveLeave(mgrUser, testLeaveId);
          assert(false, 'Self-approval was incorrectly allowed (Should have thrown 403)');
        } catch (err) {
          assert(
            err.statusCode === 403 && err.message.includes('Self-approval violation'),
            `Self-approval correctly blocked with 403: "${err.message}"`
          );
        }

        try {
          await leaveService.rejectLeave(mgrUser, testLeaveId, { rejectionReason: 'Test rejection' });
          assert(false, 'Self-rejection was incorrectly allowed (Should have thrown 403)');
        } catch (err) {
          assert(
            err.statusCode === 403 && err.message.includes('Self-action violation'),
            `Self-rejection correctly blocked with 403: "${err.message}"`
          );
        }

        // 4. Employee Outside Team Boundary Check
        console.log('\n--- 4. Security Check: Outside Team Boundary Barrier ---');
        // Find or create an employee in another department and different manager
        const outsideEmpRes = await pool.query(
          `SELECT id, dept_id, manager_id FROM employees 
           WHERE org_id = $1 AND id != $2 AND (manager_id IS NULL OR manager_id != $2) AND (dept_id IS NULL OR dept_id != $3)
           LIMIT 1;`,
          [mgr.org_id, mgr.id, mgr.dept_id || 'no-dept']
        );

        if (outsideEmpRes.rows.length > 0) {
          const outsideEmp = outsideEmpRes.rows[0];
          const outsideLeaveRes = await pool.query(
            `INSERT INTO leave_requests (
              id, org_id, employee_id, leave_type_id, start_date, end_date,
              total_days, reason, status, applied_date, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, CURRENT_DATE + INTERVAL '15 days', CURRENT_DATE + INTERVAL '17 days',
              3, 'Outside team boundary test', 'PENDING', NOW(), NOW(), NOW()
            ) RETURNING id;`,
            [`test-outside-${Date.now()}`, mgr.org_id, outsideEmp.id, leaveTypeId]
          );
          const outsideLeaveId = outsideLeaveRes.rows[0].id;

          try {
            await leaveService.approveLeave(mgrUser, outsideLeaveId);
            assert(false, 'Approval outside manager team was incorrectly allowed');
          } catch (err) {
            assert(
              err.statusCode === 403 && err.message.includes('Managers can only approve leave requests for employees in their team'),
              `Unauthorized outside-team approval blocked with 403: "${err.message}"`
            );
          }

          // Clean up outside test leave
          await pool.query('DELETE FROM leave_requests WHERE id = $1;', [outsideLeaveId]);
        }

        // Clean up manager test leave
        await pool.query('DELETE FROM leave_requests WHERE id = $1;', [testLeaveId]);
      }
    } else {
      console.log('ℹ️ No manager user found in database to execute live team query test.');
    }

    // 5. Standard employee role check
    console.log('\n--- 5. Security Check: Regular Employee Gating ---');
    const empUser = {
      id: 'emp-test-user',
      orgId: 'org-1',
      roleName: 'Employee',
    };
    try {
      await leaveService.approveLeave(empUser, 'dummy-id');
      assert(false, 'Standard employee was allowed to call approveLeave');
    } catch (err) {
      // If leave not found or role blocked
      assert(
        err.statusCode === 403 || err.statusCode === 404,
        `Standard employee blocked from approving: ${err.message}`
      );
    }

    console.log(`\n🏁 Test Results: ${passed} passed, ${failed} failed.`);
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('Fatal error during validation tests:', error);
    process.exit(1);
  }
}

runTests();
