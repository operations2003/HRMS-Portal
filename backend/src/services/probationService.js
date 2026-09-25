import { query } from '../config/db.js';
import { adminService } from './adminService.js';
import { notificationService } from './notificationService.js';

export const probationService = {
  /**
   * List all probation records for the organization with filtering and overdue status
   */
  async listProbations(orgId, filters = {}) {
    let sql = `
      SELECT e.id AS employee_id, e.employee_code, e.first_name, e.last_name, e.email,
             e.date_of_joining, e.probation_status, e.probation_start_date, e.probation_end_date,
             e.probation_notes, e.manager_id, d.name AS department_name, des.title AS designation_name,
             m.first_name AS manager_first_name, m.last_name AS manager_last_name,
             pe.id AS evaluation_id, pe.status AS evaluation_status, pe.manager_rating,
             pe.manager_recommendation, pe.manager_comments, pe.extension_months, pe.extended_until,
             pe.hr_comments, pe.review_date,
             CASE 
               WHEN e.probation_status = 'IN_PROBATION' AND e.probation_end_date < CURRENT_DATE THEN true
               ELSE false
             END AS is_overdue,
             CASE
               WHEN e.probation_status = 'IN_PROBATION' AND e.probation_end_date >= CURRENT_DATE 
                    AND e.probation_end_date <= CURRENT_DATE + INTERVAL '14 days' THEN true
               ELSE false
             END AS is_approaching_expiry
      FROM employees e
      LEFT JOIN departments d ON e.dept_id = d.id
      LEFT JOIN designations des ON e.desig_id = des.id
      LEFT JOIN employees m ON e.manager_id = m.id
      LEFT JOIN LATERAL (
        SELECT * FROM probation_evaluations 
        WHERE employee_id = e.id 
        ORDER BY created_at DESC 
        LIMIT 1
      ) pe ON true
      WHERE e.org_id = $1
    `;
    const params = [orgId];

    if (filters.status) {
      params.push(filters.status);
      sql += ` AND e.probation_status = $${params.length}`;
    }
    if (filters.managerId) {
      params.push(filters.managerId);
      sql += ` AND e.manager_id = $${params.length}`;
    }
    if (filters.isOverdue === 'true' || filters.isOverdue === true) {
      sql += ` AND e.probation_status = 'IN_PROBATION' AND e.probation_end_date < CURRENT_DATE`;
    }
    if (filters.search) {
      params.push(`%${filters.search.toLowerCase()}%`);
      sql += ` AND (LOWER(e.first_name) LIKE $${params.length} OR LOWER(e.last_name) LIKE $${params.length} OR LOWER(e.employee_code) LIKE $${params.length})`;
    }

    sql += ` ORDER BY is_overdue DESC, e.probation_end_date ASC NULLS LAST;`;

    const res = await query(sql, params);

    // Compute summary stats
    const stats = {
      totalInProbation: res.rows.filter((r) => r.probation_status === 'IN_PROBATION').length,
      overdueCount: res.rows.filter((r) => r.is_overdue).length,
      approachingExpiryCount: res.rows.filter((r) => r.is_approaching_expiry).length,
      confirmedCount: res.rows.filter((r) => r.probation_status === 'CONFIRMED').length,
      notEligibleCount: res.rows.filter((r) => r.probation_status === 'NOT_ELIGIBLE').length,
      extendedCount: res.rows.filter((r) => r.probation_status === 'EXTENDED').length,
      rejectedCount: res.rows.filter((r) => r.probation_status === 'REJECTED').length,
    };

    return { stats, records: res.rows };
  },

  /**
   * Manager submits evaluation for an employee
   */
  async submitEvaluation(employeeId, orgId, managerUser, payload) {
    // 1. Prevent self-approval
    if (managerUser.employeeId && managerUser.employeeId === employeeId) {
      const err = new Error('Security Violation: You cannot evaluate or approve your own probation.');
      err.statusCode = 403;
      throw err;
    }

    const empRes = await query('SELECT * FROM employees WHERE id = $1 AND org_id = $2;', [employeeId, orgId]);
    if (empRes.rows.length === 0) {
      const err = new Error('Employee not found.');
      err.statusCode = 404;
      throw err;
    }
    const emp = empRes.rows[0];

    // Check manager authority: must be the employee's designated manager or HR/Admin
    const isManager = managerUser.employeeId && emp.manager_id === managerUser.employeeId;
    const isPrivileged = managerUser.roleName && ['admin', 'superadmin', 'orgadmin', 'hr', 'hrmanager'].includes(managerUser.roleName.toLowerCase());
    if (!isManager && !isPrivileged) {
      const err = new Error('Access denied: You are not authorized to evaluate this employee.');
      err.statusCode = 403;
      throw err;
    }

    const evalId = `prbeval-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const rating = parseInt(payload.rating, 10);
    const recommendation = payload.recommendation; // CONFIRM, EXTEND, REJECT, NOT_ELIGIBLE
    const comments = payload.comments || '';
    const extensionMonths = payload.extensionMonths ? parseInt(payload.extensionMonths, 10) : 0;
    
    let extendedUntil = null;
    if (recommendation === 'EXTEND' && extensionMonths > 0) {
      const curEndDate = emp.probation_end_date ? new Date(emp.probation_end_date) : new Date();
      curEndDate.setMonth(curEndDate.getMonth() + extensionMonths);
      extendedUntil = curEndDate.toISOString().split('T')[0];
    }

    await query(
      `INSERT INTO probation_evaluations (
        id, org_id, employee_id, manager_id, review_date, status,
        manager_rating, manager_recommendation, manager_comments,
        extension_months, extended_until, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, CURRENT_DATE, 'MANAGER_EVALUATED', $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *;`,
      [evalId, orgId, employeeId, managerUser.employeeId, rating, recommendation, comments, extensionMonths, extendedUntil]
    );

    // Audit log
    await adminService.logAction({
      orgId,
      actorUserId: managerUser.id,
      actorRole: managerUser.roleName,
      targetType: 'PROBATION',
      targetId: evalId,
      action: 'MANAGER_EVALUATION',
      details: { employeeId, rating, recommendation, comments },
    }).catch(() => {});

    // Notify HR
    await notificationService.createNotification({
      orgId,
      userId: emp.user_id,
      eventType: 'PROBATION_EVALUATION_SUBMITTED',
      title: 'Probation Evaluation Submitted',
      message: `Manager has submitted a probation evaluation for ${emp.first_name} ${emp.last_name}.`,
      entityType: 'PROBATION',
      entityId: evalId,
    }).catch(() => {});

    return { message: 'Probation evaluation submitted successfully.', evaluationId: evalId };
  },

  /**
   * HR completes final review & confirmation/extension/rejection
   */
  async hrReview(employeeId, orgId, hrUser, payload) {
    // 1. Prevent self-approval
    if (hrUser.employeeId && hrUser.employeeId === employeeId) {
      const err = new Error('Security Violation: You cannot finalize your own probation.');
      err.statusCode = 403;
      throw err;
    }

    const empRes = await query('SELECT * FROM employees WHERE id = $1 AND org_id = $2;', [employeeId, orgId]);
    if (empRes.rows.length === 0) {
      const err = new Error('Employee not found.');
      err.statusCode = 404;
      throw err;
    }
    const emp = empRes.rows[0];

    const decision = payload.decision; // CONFIRMED, EXTENDED, REJECTED, NOT_ELIGIBLE
    if (!['CONFIRMED', 'EXTENDED', 'REJECTED', 'NOT_ELIGIBLE'].includes(decision)) {
      const err = new Error('Invalid decision. Must be CONFIRMED, EXTENDED, REJECTED, or NOT_ELIGIBLE.');
      err.statusCode = 400;
      throw err;
    }

    const hrComments = payload.hrComments || '';
    const extensionMonths = payload.extensionMonths ? parseInt(payload.extensionMonths, 10) : 0;
    let newEndDate = emp.probation_end_date;

    if (decision === 'EXTENDED' && extensionMonths > 0) {
      const curEndDate = emp.probation_end_date ? new Date(emp.probation_end_date) : new Date();
      curEndDate.setMonth(curEndDate.getMonth() + extensionMonths);
      newEndDate = curEndDate.toISOString().split('T')[0];
    } else if (decision === 'CONFIRMED' || decision === 'NOT_ELIGIBLE') {
      newEndDate = null;
    }

    // Update Employee record
    await query(
      `UPDATE employees 
       SET probation_status = $1, 
           probation_end_date = $2, 
           probation_notes = $3,
           updated_at = NOW()
       WHERE id = $4 AND org_id = $5;`,
      [decision, newEndDate, hrComments, employeeId, orgId]
    );

    // Update or insert probation evaluation record
    const evalRes = await query(
      `SELECT id FROM probation_evaluations 
       WHERE employee_id = $1 AND org_id = $2 
       ORDER BY created_at DESC LIMIT 1;`,
      [employeeId, orgId]
    );

    if (evalRes.rows.length > 0) {
      await query(
        `UPDATE probation_evaluations 
         SET status = $1, hr_comments = $2, reviewed_by_hr_id = $3, 
             extended_until = $4, updated_at = NOW()
         WHERE id = $5;`,
        [decision, hrComments, hrUser.id, decision === 'EXTENDED' ? newEndDate : null, evalRes.rows[0].id]
      );
    } else {
      const evalId = `prbeval-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      await query(
        `INSERT INTO probation_evaluations (
          id, org_id, employee_id, review_date, status,
          hr_comments, reviewed_by_hr_id, extended_until, created_at, updated_at
        ) VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6, $7, NOW(), NOW());`,
        [evalId, orgId, employeeId, decision, hrComments, hrUser.id, decision === 'EXTENDED' ? newEndDate : null]
      );
    }

    // Audit log
    await adminService.logAction({
      orgId,
      actorUserId: hrUser.id,
      actorRole: hrUser.roleName,
      targetType: 'PROBATION',
      targetId: employeeId,
      action: `PROBATION_${decision}`,
      details: { decision, hrComments, newEndDate },
    }).catch(() => {});

    // Notify employee
    if (emp.user_id) {
      await notificationService.createNotification({
        orgId,
        userId: emp.user_id,
        eventType: 'PROBATION_DECISION_FINALIZED',
        title: `Probation Decision: ${decision}`,
        message: `Your probation status has been finalized as ${decision}. ${hrComments}`,
        entityType: 'PROBATION',
        entityId: employeeId,
      }).catch(() => {});
    }

    return {
      message: `Employee probation marked as ${decision}.`,
      probationStatus: decision,
      probationEndDate: newEndDate,
    };
  },
};
