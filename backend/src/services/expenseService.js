import { query } from '../config/db.js';
import { adminService } from './adminService.js';
import { notificationService } from './notificationService.js';

export const expenseService = {
  /**
   * List expense claims with role-based scoping
   */
  async listExpenses(orgId, currentUser, filters = {}) {
    let sql = `
      SELECT ec.*,
             e.first_name, e.last_name, e.employee_code, e.email,
             d.name AS department_name,
             m.first_name AS manager_first, m.last_name AS manager_last,
             u.first_name AS hr_first, u.last_name AS hr_last
      FROM expense_claims ec
      JOIN employees e ON ec.employee_id = e.id
      LEFT JOIN departments d ON e.dept_id = d.id
      LEFT JOIN employees m ON ec.manager_id = m.id
      LEFT JOIN users u ON ec.hr_id = u.id
      WHERE ec.org_id = $1
    `;
    const params = [orgId];

    // Scoping: standard employees only see their own claims
    const isPrivileged = currentUser.roleName && ['admin', 'superadmin', 'orgadmin', 'hr', 'hrmanager'].includes(currentUser.roleName.toLowerCase());
    const isManager = (currentUser.roleName || '').toLowerCase() === 'manager';

    if (!isPrivileged && currentUser.employeeId) {
      if (isManager) {
        params.push(currentUser.employeeId);
        sql += ` AND (ec.employee_id = $${params.length} OR e.manager_id = $${params.length})`;
      } else {
        params.push(currentUser.employeeId);
        sql += ` AND ec.employee_id = $${params.length}`;
      }
    }

    if (filters.status) {
      params.push(filters.status);
      sql += ` AND ec.status = $${params.length}`;
    }
    if (filters.category) {
      params.push(filters.category);
      sql += ` AND ec.category = $${params.length}`;
    }
    if (filters.search) {
      params.push(`%${filters.search.toLowerCase()}%`);
      sql += ` AND (LOWER(ec.claim_number) LIKE $${params.length} OR LOWER(ec.description) LIKE $${params.length})`;
    }

    sql += ` ORDER BY ec.created_at DESC;`;

    const res = await query(sql, params);
    return res.rows;
  },

  /**
   * Submit new expense claim
   */
  async submitClaim(orgId, currentUser, payload) {
    const employeeId = currentUser.employeeId;
    if (!employeeId) {
      const err = new Error('You must be linked to an employee profile to submit expense claims.');
      err.statusCode = 400;
      throw err;
    }

    const amount = parseFloat(payload.amount);
    if (!amount || amount <= 0) {
      const err = new Error('Amount must be a positive number.');
      err.statusCode = 400;
      throw err;
    }

    const claimNumber = `EXP-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const id = `exp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // Fetch employee's manager
    const empRes = await query('SELECT manager_id FROM employees WHERE id = $1;', [employeeId]);
    const managerId = empRes.rows[0]?.manager_id || null;

    const res = await query(
      `INSERT INTO expense_claims (
        id, org_id, claim_number, employee_id, category, amount, currency,
        expense_date, description, receipt_url, status, manager_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'INR', $7, $8, $9, 'SUBMITTED', $10, NOW(), NOW())
      RETURNING *;`,
      [
        id,
        orgId,
        claimNumber,
        employeeId,
        payload.category || 'OTHER',
        amount,
        payload.expenseDate || new Date().toISOString().split('T')[0],
        payload.description,
        payload.receiptUrl || null,
        managerId,
      ]
    );

    const claim = res.rows[0];

    // Audit log
    await adminService.logAction({
      orgId,
      actorUserId: currentUser.id,
      actorRole: currentUser.roleName,
      targetType: 'EXPENSE',
      targetId: id,
      action: 'SUBMIT_EXPENSE',
      details: { claimNumber, amount, category: claim.category },
    }).catch(() => {});

    // Notify manager if exists
    if (managerId) {
      const mRes = await query('SELECT user_id FROM employees WHERE id = $1;', [managerId]);
      if (mRes.rows[0]?.user_id) {
        await notificationService.createNotification({
          orgId,
          userId: mRes.rows[0].user_id,
          eventType: 'EXPENSE_SUBMITTED',
          title: `Expense Claim Submitted: ${claimNumber}`,
          message: `${currentUser.firstName} submitted an expense claim of ₹${amount} for ${claim.category}.`,
          entityType: 'EXPENSE',
          entityId: id,
        }).catch(() => {});
      }
    }

    return claim;
  },

  /**
   * Manager / HR Review and Approval
   */
  async reviewClaim(claimId, orgId, currentUser, payload) {
    const claimRes = await query('SELECT * FROM expense_claims WHERE id = $1 AND org_id = $2;', [claimId, orgId]);
    if (claimRes.rows.length === 0) {
      const err = new Error('Expense claim not found.');
      err.statusCode = 404;
      throw err;
    }
    const claim = claimRes.rows[0];

    // Prevent self-approval
    if (currentUser.employeeId && currentUser.employeeId === claim.employee_id) {
      const err = new Error('Security Violation: You cannot review or approve your own expense claim.');
      err.statusCode = 403;
      throw err;
    }

    const action = payload.action; // APPROVE, REJECT, REWORK, REIMBURSE
    const comments = payload.comments || '';
    const isHr = currentUser.roleName && ['hr', 'hrmanager', 'admin', 'superadmin', 'orgadmin'].includes(currentUser.roleName.toLowerCase());

    let newStatus = claim.status;
    let updateFields = [];
    let params = [claimId, orgId];

    if (action === 'APPROVE') {
      if (isHr) {
        newStatus = 'REIMBURSEMENT_PENDING';
        updateFields.push(`hr_id = $3`, `hr_approval_date = NOW()`, `hr_comments = $4`);
        params.push(currentUser.id, comments);
      } else {
        newStatus = 'APPROVED';
        updateFields.push(`manager_approval_date = NOW()`, `manager_comments = $3`);
        params.push(comments);
      }
    } else if (action === 'REJECT') {
      newStatus = 'REJECTED';
      updateFields.push(`rejection_reason = $3`);
      params.push(comments);
    } else if (action === 'REWORK') {
      newStatus = 'REWORK_REQUIRED';
      updateFields.push(`rejection_reason = $3`);
      params.push(comments);
    } else if (action === 'REIMBURSE') {
      if (!isHr) {
        const err = new Error('Access denied: Only HR or Finance can mark claims as reimbursed.');
        err.statusCode = 403;
        throw err;
      }
      newStatus = 'REIMBURSED';
      updateFields.push(`reimbursed_at = NOW()`, `payment_reference = $3`);
      params.push(payload.paymentReference || 'BANK-DISBURSEMENT');
    }

    params.push(newStatus);
    const statusParamIdx = params.length;

    const sql = `
      UPDATE expense_claims 
      SET status = $${statusParamIdx}, updated_at = NOW()
          ${updateFields.length > 0 ? ', ' + updateFields.join(', ') : ''}
      WHERE id = $1 AND org_id = $2
      RETURNING *;
    `;

    const res = await query(sql, params);
    const updated = res.rows[0];

    // Audit log
    await adminService.logAction({
      orgId,
      actorUserId: currentUser.id,
      actorRole: currentUser.roleName,
      targetType: 'EXPENSE',
      targetId: claimId,
      action: `EXPENSE_${action}`,
      details: { fromStatus: claim.status, toStatus: newStatus, comments },
    }).catch(() => {});

    // Notify employee
    const empRes = await query('SELECT user_id FROM employees WHERE id = $1;', [claim.employee_id]);
    if (empRes.rows[0]?.user_id) {
      await notificationService.createNotification({
        orgId,
        userId: empRes.rows[0].user_id,
        eventType: 'EXPENSE_STATUS_UPDATED',
        title: `Expense Claim ${claim.claim_number}: ${newStatus}`,
        message: `Your claim of ₹${claim.amount} is now ${newStatus}. ${comments}`,
        entityType: 'EXPENSE',
        entityId: claimId,
      }).catch(() => {});
    }

    return updated;
  },
};

