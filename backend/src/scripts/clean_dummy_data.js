import { getDirectClient } from '../config/db.js';

const isDryRun = process.argv.includes('--dry-run');

const REAL_ORG_ID = 'org-1';

const REAL_USER_IDS = [
  'user-superadmin-shubham',
  'user-1789558456935',
  'user-1789565075726',
  'user-1789637937505',
  'user-1789638224824',
  'user-1789638386425'
];

const REAL_EMPLOYEE_IDS = [
  'emp-shubham-admin',
  'emp-1789558457030',
  'emp-1789565076012',
  'emp-1789637937697',
  'emp-1789638224986',
  'emp-1789638386697'
];

const REAL_DEPT_IDS = [
  'dept-ta',
  'dept-ld',
  'dept-it',
  'dept-bd',
  'dept-ops',
  'dept-hr'
];

const REAL_LEAVE_TYPE_IDS = [
  'lt-cl',
  'lt-sl',
  'lt-el',
  'lt-pl',
  'lt-ml',
  'lt-patl',
  'lt-lwp'
];


const REAL_ROLE_IDS = [
  'role-admin',
  'role-hr',
  'role-manager',
  'role-employee'
];

async function runCleanup() {
  console.log('====================================================');
  console.log(`🧹 HRMS Database Test / Dummy Data Cleanup Utility`);
  console.log(`Mode: ${isDryRun ? '🔍 DRY RUN (No changes will be committed)' : '⚡ LIVE RUN (Changes will be permanently committed)'}`);
  console.log('====================================================\n');

  const client = getDirectClient();
  await client.connect();

  try {
    await client.query('BEGIN');

    // Helper query runner
    const runDelete = async (desc, sql, params = []) => {
      const res = await client.query(sql, params);
      console.log(`  🗑️  [${res.rowCount.toString().padStart(4)}] ${desc}`);
      return res.rowCount;
    };

    console.log('Step 1: Cleaning Exit & Offboarding test records...');
    await runDelete('access_deprovisioning_audits', 'DELETE FROM access_deprovisioning_audits;');
    await runDelete('fnf_settlements', 'DELETE FROM fnf_settlements;');
    await runDelete('exit_clearance_checklists', 'DELETE FROM exit_clearance_checklists;');
    await runDelete('employee_offboardings', 'DELETE FROM employee_offboardings;');
    await runDelete('exit_requests', 'DELETE FROM exit_requests;');

    console.log('\nStep 2: Cleaning Admin test audit logs and test configurations...');
    await runDelete('admin_audit_logs', 'DELETE FROM admin_audit_logs;');
    await runDelete('admin_configurations (non-org-1)', 'DELETE FROM admin_configurations WHERE org_id != $1;', [REAL_ORG_ID]);

    console.log('\nStep 3: Cleaning Helpdesk ticket test records...');
    await runDelete(
      'ticket_comments (from test users/tickets)',
      `DELETE FROM ticket_comments 
       WHERE org_id != $1 
          OR NOT (user_id = ANY($2))
          OR ticket_id IN (SELECT id FROM helpdesk_tickets WHERE subject LIKE 'Regression Verification%' OR NOT (employee_id = ANY($3)));`,
      [REAL_ORG_ID, REAL_USER_IDS, REAL_EMPLOYEE_IDS]
    );
    await runDelete(
      'helpdesk_tickets (regression tests & test employees)',
      `DELETE FROM helpdesk_tickets 
       WHERE org_id != $1 
          OR subject LIKE 'Regression Verification%'
          OR NOT (employee_id = ANY($2));`,
      [REAL_ORG_ID, REAL_EMPLOYEE_IDS]
    );

    console.log('\nStep 4: Cleaning Employee Requests test updates & test requests...');
    await runDelete(
      'employee_request_updates (test orgs / test users)',
      `DELETE FROM employee_request_updates 
       WHERE org_id != $1 OR NOT (user_id = ANY($2));`,
      [REAL_ORG_ID, REAL_USER_IDS]
    );
    await runDelete(
      'employee_requests (test orgs / test employees)',
      `DELETE FROM employee_requests 
       WHERE org_id != $1 OR NOT (employee_id = ANY($2));`,
      [REAL_ORG_ID, REAL_EMPLOYEE_IDS]
    );

    console.log('\nStep 5: Cleaning Performance module test data...');
    await runDelete(
      'performance_goals (test employees)',
      `DELETE FROM performance_goals 
       WHERE NOT (employee_id = ANY($1)) 
          OR performance_record_id IN (SELECT id FROM performance_records WHERE NOT (employee_id = ANY($1)));`,
      [REAL_EMPLOYEE_IDS]
    );
    await runDelete(
      'performance_review_history (test employees / test actors)',
      `DELETE FROM performance_review_history 
       WHERE NOT (actor_user_id = ANY($1)) 
          OR performance_record_id IN (SELECT id FROM performance_records WHERE NOT (employee_id = ANY($2)));`,
      [REAL_USER_IDS, REAL_EMPLOYEE_IDS]
    );
    await runDelete(
      'performance_records (test employees / test orgs)',
      `DELETE FROM performance_records 
       WHERE org_id != $1 OR NOT (employee_id = ANY($2));`,
      [REAL_ORG_ID, REAL_EMPLOYEE_IDS]
    );
    await runDelete(
      'performance_periods (unlinked test periods)',
      `DELETE FROM performance_periods 
       WHERE org_id != $1 
          OR id NOT IN (SELECT DISTINCT period_id FROM performance_records WHERE period_id IS NOT NULL);`,
      [REAL_ORG_ID]
    );

    console.log('\nStep 6: Cleaning Approval Workflows & Notifications...');
    await runDelete(
      'approval_workflow_actions (test actors / test workflows)',
      `DELETE FROM approval_workflow_actions 
       WHERE NOT (actor_user_id = ANY($1))
          OR workflow_id IN (SELECT id FROM approval_workflows WHERE org_id != $2 OR NOT (requester_id = ANY($3)));`,
      [REAL_USER_IDS, REAL_ORG_ID, REAL_EMPLOYEE_IDS]
    );
    await runDelete(
      'approval_workflows (test employees / test orgs)',
      `DELETE FROM approval_workflows 
       WHERE org_id != $1 OR NOT (requester_id = ANY($2));`,
      [REAL_ORG_ID, REAL_EMPLOYEE_IDS]
    );
    await runDelete(
      'notifications (test users / test orgs)',
      `DELETE FROM notifications 
       WHERE org_id != $1 OR NOT (user_id = ANY($2));`,
      [REAL_ORG_ID, REAL_USER_IDS]
    );


    console.log('\nStep 8: Cleaning Leave and Attendance test records...');
    await runDelete(
      'leave_requests (test employees / test orgs)',
      `DELETE FROM leave_requests WHERE org_id != $1 OR NOT (employee_id = ANY($2));`,
      [REAL_ORG_ID, REAL_EMPLOYEE_IDS]
    );
    await runDelete(
      'leave_balances (test employees / test orgs)',
      `DELETE FROM leave_balances WHERE org_id != $1 OR NOT (employee_id = ANY($2));`,
      [REAL_ORG_ID, REAL_EMPLOYEE_IDS]
    );
    await runDelete(
      'leave_types (test leave types)',
      `DELETE FROM leave_types WHERE org_id != $1 OR NOT (id = ANY($2));`,
      [REAL_ORG_ID, REAL_LEAVE_TYPE_IDS]
    );
    await runDelete(
      'attendance_records (test employees / test orgs)',
      `DELETE FROM attendance_records WHERE org_id != $1 OR NOT (employee_id = ANY($2));`,
      [REAL_ORG_ID, REAL_EMPLOYEE_IDS]
    );
    await runDelete(
      'holidays (test orgs)',
      `DELETE FROM holidays WHERE org_id != $1;`,
      [REAL_ORG_ID]
    );

    console.log('\nStep 9: Cleaning Document Vault test files & Onboarding test records...');
    // Clear any foreign references to document_vault before deleting docs
    await runDelete(
      'Clear document_vault_id references in employee_requests',
      `UPDATE employee_requests SET document_vault_id = NULL WHERE document_vault_id IS NOT NULL;`
    );

    await runDelete('document_vault (test uploaded files)', 'DELETE FROM document_vault;');
    await runDelete('new_hires (dummy / test hires)', 'DELETE FROM new_hires;');
    await runDelete('onboarding_documents', 'DELETE FROM onboarding_documents;');
    await runDelete('onboarding_checklists', 'DELETE FROM onboarding_checklists;');
    await runDelete('onboarding_it_setup', 'DELETE FROM onboarding_it_setup;');
    await runDelete('onboarding_candidates', 'DELETE FROM onboarding_candidates;');

    console.log('\nStep 9b: Cleaning HRMS v2 Modules test records...');
    await runDelete(
      'work_tasks (test tasks)',
      `DELETE FROM work_tasks WHERE NOT (assignee_id = ANY($1) OR creator_id = ANY($1));`,
      [REAL_EMPLOYEE_IDS]
    );
    await runDelete(
      'expense_claims (test expense claims)',
      `DELETE FROM expense_claims WHERE NOT (employee_id = ANY($1));`,
      [REAL_EMPLOYEE_IDS]
    );
    await runDelete(
      'course_enrollments (test enrollments)',
      `DELETE FROM course_enrollments WHERE NOT (employee_id = ANY($1));`,
      [REAL_EMPLOYEE_IDS]
    );
    await runDelete(
      'employee_skills (test skills)',
      `DELETE FROM employee_skills WHERE NOT (employee_id = ANY($1));`,
      [REAL_EMPLOYEE_IDS]
    );
    await runDelete(
      'courses (test courses)',
      `DELETE FROM courses WHERE org_id != $1;`,
      [REAL_ORG_ID]
    );
    await runDelete(
      'announcement_read_receipts (test receipts)',
      `DELETE FROM announcement_read_receipts WHERE NOT (user_id = ANY($1));`,
      [REAL_USER_IDS]
    );
    await runDelete(
      'announcements (test announcements)',
      `DELETE FROM announcements WHERE org_id != $1;`,
      [REAL_ORG_ID]
    );
    await runDelete(
      'survey_responses (test survey responses)',
      `DELETE FROM survey_responses WHERE NOT (respondent_id = ANY($1));`,
      [REAL_USER_IDS]
    );
    await runDelete(
      'engagement_surveys (test surveys)',
      `DELETE FROM engagement_surveys WHERE org_id != $1;`,
      [REAL_ORG_ID]
    );
    await runDelete(
      'employee_recognitions (test recognitions)',
      `DELETE FROM employee_recognitions WHERE NOT (sender_id = ANY($1) AND recipient_id = ANY($1));`,
      [REAL_EMPLOYEE_IDS]
    );
    await runDelete(
      'probation_evaluations (test evaluations)',
      `DELETE FROM probation_evaluations WHERE NOT (employee_id = ANY($1));`,
      [REAL_EMPLOYEE_IDS]
    );

    console.log('\nStep 10: Cleaning Employee & User test accounts and associations...');
    // Break any self-referencing manager_id links on employees first
    await client.query('UPDATE employees SET manager_id = NULL WHERE NOT (id = ANY($1));', [REAL_EMPLOYEE_IDS]);
    
    // Clear user_roles for test users
    await runDelete(
      'user_roles (test users)',
      `DELETE FROM user_roles WHERE NOT (user_id = ANY($1));`,
      [REAL_USER_IDS]
    );

    // Delete test employees
    await runDelete(
      'employees (test employees)',
      `DELETE FROM employees WHERE org_id != $1 OR NOT (id = ANY($2));`,
      [REAL_ORG_ID, REAL_EMPLOYEE_IDS]
    );

    // Delete test users
    await runDelete(
      'users (test users)',
      `DELETE FROM users WHERE org_id != $1 OR NOT (id = ANY($2));`,
      [REAL_ORG_ID, REAL_USER_IDS]
    );

    console.log('\nStep 11: Cleaning test Departments, Designations & test Organizations...');
    await runDelete(
      'departments (test departments)',
      `DELETE FROM departments WHERE org_id != $1 OR NOT (id = ANY($2));`,
      [REAL_ORG_ID, REAL_DEPT_IDS]
    );
    await runDelete(
      'designations (test orgs)',
      `DELETE FROM designations WHERE org_id != $1;`,
      [REAL_ORG_ID]
    );
    await runDelete(
      'organizations (test organizations)',
      `DELETE FROM organizations WHERE id != $1;`,
      [REAL_ORG_ID]
    );

    console.log('\nStep 12: Cleaning Custom Test Roles & Permissions...');
    await runDelete(
      'role_permissions (test roles)',
      `DELETE FROM role_permissions WHERE NOT (role_id = ANY($1));`,
      [REAL_ROLE_IDS]
    );
    await runDelete(
      'user_roles (test roles)',
      `DELETE FROM user_roles WHERE NOT (role_id = ANY($1));`,
      [REAL_ROLE_IDS]
    );
    await client.query(
      `UPDATE users SET role_id = 'role-employee' WHERE NOT (role_id = ANY($1));`,
      [REAL_ROLE_IDS]
    );
    await runDelete(
      'roles (custom test roles like Custom Auditor)',
      `DELETE FROM roles WHERE NOT (id = ANY($1));`,
      [REAL_ROLE_IDS]
    );

    if (isDryRun) {
      console.log('\n====================================================');
      console.log('🔍 DRY RUN COMPLETE: Rolling back all changes.');
      console.log('====================================================');
      await client.query('ROLLBACK');
    } else {
      console.log('\n====================================================');
      console.log('💾 COMMITTING CHANGES TO DATABASE...');
      await client.query('COMMIT');
      console.log('🎉 LIVE CLEANUP COMMITTED SUCCESSFULLY!');
      console.log('====================================================\n');

      console.log('📊 Post-Cleanup Database State (Active Production Records):');
      const verifyTables = [
        'organizations', 'departments', 'designations', 'roles', 'permissions',
        'users', 'employees', 'user_roles', 'holidays', 'leave_types',
        'leave_requests', 'leave_balances', 'attendance_records', 'helpdesk_tickets',
        'employee_requests', 'probation_evaluations', 'courses', 'course_enrollments',
        'announcements', 'work_tasks', 'expense_claims',
        'performance_records', 'performance_periods', 'approval_workflows',
        'notifications', 'admin_configurations', 'document_vault', 'new_hires'
      ];
      for (const t of verifyTables) {
        try {
          const res = await client.query(`SELECT COUNT(*) FROM "${t}";`);
          console.log(`  ✓ ${t.padEnd(28)}: ${res.rows[0].count} records`);
        } catch (e) {
          console.log(`  ✓ ${t.padEnd(28)}: error (${e.message})`);
        }
      }
    }


  } catch (err) {
    console.error('\n💥 Cleanup failed with error:', err);
    try {
      await client.query('ROLLBACK');
      console.log('🔄 Rolled back transaction safely.');
    } catch (rbErr) {
      console.error('Rollback error:', rbErr.message);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

runCleanup();
