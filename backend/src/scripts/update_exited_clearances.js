import 'dotenv/config';
import { query } from '../config/db.js';

async function run() {
  const exitedEmps = [
    { id: 'emp-1790257614844', resDate: '2026-10-04', lwd: '2026-10-04' },
    { id: 'emp-1790261288728', resDate: '2026-10-04', lwd: '2026-10-04' },
    { id: 'emp-1790315991598', resDate: '2026-10-04', lwd: '2026-10-04' },
    { id: 'emp-1790316473501', resDate: '2026-09-27', lwd: '2026-09-27' },
  ];

  for (const emp of exitedEmps) {
    // 1. Update employee status to Exited
    await query("UPDATE employees SET status = 'Exited', updated_at = NOW() WHERE id = $1", [emp.id]);

    // 2. Update exit requests
    await query("UPDATE exit_requests SET status = 'COMPLETED', current_stage = 'COMPLETED', updated_at = NOW() WHERE employee_id = $1", [emp.id]);

    // 3. Update employee_offboardings
    await query("UPDATE employee_offboardings SET offboarding_status = 'COMPLETED', clearance_status = 'CLEARED', access_removal_status = 'DEPROVISIONED', hr_completion_status = 'COMPLETED', completed_date = NOW(), completed_at = NOW(), updated_at = NOW() WHERE employee_id = $1", [emp.id]);

    // 4. Update exit_clearance_checklists
    await query("UPDATE exit_clearance_checklists SET status = 'CLEARED', completed_at = NOW(), updated_at = NOW() WHERE employee_id = $1", [emp.id]);

    // 5. Check if exit checklist already exists
    const existing = await query("SELECT id FROM exit_checklists WHERE employee_id = $1", [emp.id]);
    if (existing.rows.length === 0) {
      const chkId = 'chk-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      await query(
        `INSERT INTO exit_checklists (id, org_id, employee_id, resignation_date, last_working_day, status, created_by, completed_at, completed_by, notes)
         VALUES ($1, 'org-1', $2, $3, $4, 'Completed', 'user-superadmin-shubham', NOW(), 'user-superadmin-shubham', 'Separation and clearances fully completed.')`,
        [chkId, emp.id, emp.resDate, emp.lwd]
      );

      const items = [
        'Resignation Approved',
        'Knowledge Transfer Completed',
        'Company Assets Returned',
        'System Access Revoked',
        'Full & Final Settlement Completed',
      ];

      for (let i = 0; i < items.length; i++) {
        const itemId = 'chki-' + Date.now() + '-' + (i + 1) + '-' + Math.floor(Math.random() * 1000);
        await query(
          `INSERT INTO exit_checklist_items (id, checklist_id, title, status, completed_at, completed_by, order_index)
           VALUES ($1, $2, $3, 'Completed', NOW(), 'user-superadmin-shubham', $4)`,
          [itemId, chkId, items[i], i]
        );
      }
      console.log('Created checklist for', emp.id, '->', chkId);
    } else {
      await query("UPDATE exit_checklists SET status = 'Completed', completed_at = NOW(), completed_by = 'user-superadmin-shubham' WHERE employee_id = $1", [emp.id]);
      await query("UPDATE exit_checklist_items SET status = 'Completed', completed_at = NOW(), completed_by = 'user-superadmin-shubham' WHERE checklist_id = $1", [existing.rows[0].id]);
      console.log('Updated existing checklist for', emp.id);
    }
  }

  console.log('ALL UPDATES COMPLETE!');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
