import { pool } from '../config/db.js';

/**
 * Maps database row to structured Workflow Instance object
 */
const mapWorkflowRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.org_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    workflowType: row.workflow_type,
    currentStage: row.current_stage,
    currentStatus: row.current_status,
    requesterId: row.requester_id,
    managerId: row.manager_id || null,
    hrUserId: row.hr_user_id || null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    requester: row.req_id
      ? {
          id: row.req_id,
          employeeCode: row.req_code,
          fullName: `${row.req_first_name || ''} ${row.req_last_name || ''}`.trim(),
          email: row.req_email,
        }
      : undefined,
    manager: row.mgr_id
      ? {
          id: row.mgr_id,
          employeeCode: row.mgr_code,
          fullName: `${row.mgr_first_name || ''} ${row.mgr_last_name || ''}`.trim(),
          email: row.mgr_email,
        }
      : null,
    hrUser: row.hr_id
      ? {
          id: row.hr_id,
          fullName: `${row.hr_first_name || ''} ${row.hr_last_name || ''}`.trim(),
          email: row.hr_email,
        }
      : null,
    actions: Array.isArray(row.actions) ? row.actions.map(mapActionRow) : undefined,
  };
};

/**
 * Maps action row
 */
const mapActionRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    workflowId: row.workflow_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    stage: row.stage,
    actorUserId: row.actor_user_id,
    actorRole: row.actor_role,
    action: row.action,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    comments: row.comments || '',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    actor: row.u_id
      ? {
          id: row.u_id,
          fullName: `${row.u_first_name || ''} ${row.u_last_name || ''}`.trim(),
          email: row.u_email,
        }
      : undefined,
  };
};

export const workflowRepository = {
  /**
   * 1. Initialize a new Approval Workflow Instance
   */
  async createWorkflowInstance(data, initialAction = null) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const id = data.id || `wf-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const wfQuery = `
        INSERT INTO approval_workflows (
          id, org_id, entity_type, entity_id, workflow_type,
          current_stage, current_status, requester_id, manager_id, hr_user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *;
      `;
      const wfValues = [
        id,
        data.orgId,
        data.entityType,
        data.entityId,
        data.workflowType || 'EMPLOYEE_MANAGER_HR',
        data.currentStage || 'MANAGER_REVIEW',
        data.currentStatus || 'SUBMITTED',
        data.requesterId,
        data.managerId || null,
        data.hrUserId || null,
      ];
      const { rows } = await client.query(wfQuery, wfValues);
      const insertedWf = rows[0];

      if (initialAction) {
        const actionId = initialAction.id || `wfa-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const actionQuery = `
          INSERT INTO approval_workflow_actions (
            id, workflow_id, entity_type, entity_id, stage,
            actor_user_id, actor_role, action, from_status, to_status, comments
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *;
        `;
        const actionValues = [
          actionId,
          insertedWf.id,
          data.entityType,
          data.entityId,
          initialAction.stage || 'EMPLOYEE_SUBMISSION',
          initialAction.actorUserId,
          initialAction.actorRole || 'EMPLOYEE',
          initialAction.action || 'SUBMIT',
          initialAction.fromStatus || 'DRAFT',
          initialAction.toStatus || 'SUBMITTED',
          initialAction.comments || '',
        ];
        const actionRes = await client.query(actionQuery, actionValues);
        insertedWf.actions = [actionRes.rows[0]];
      }

      await client.query('COMMIT');
      return mapWorkflowRow(insertedWf);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * 2. Find Workflow by Entity Type & ID
   */
  async findByEntity(entityType, entityId) {
    const query = `
      SELECT 
        w.*,
        req.id AS req_id, req.employee_code AS req_code, req.first_name AS req_first_name, req.last_name AS req_last_name, req.email AS req_email,
        mgr.id AS mgr_id, mgr.employee_code AS mgr_code, mgr.first_name AS mgr_first_name, mgr.last_name AS mgr_last_name, mgr.email AS mgr_email,
        hr.id AS hr_id, hr.first_name AS hr_first_name, hr.last_name AS hr_last_name, hr.email AS hr_email
      FROM approval_workflows w
      JOIN employees req ON w.requester_id = req.id
      LEFT JOIN employees mgr ON w.manager_id = mgr.id
      LEFT JOIN users hr ON w.hr_user_id = hr.id
      WHERE w.entity_type = $1 AND w.entity_id = $2;
    `;
    const { rows } = await pool.query(query, [entityType, entityId]);
    if (!rows[0]) return null;

    const wf = rows[0];

    // Fetch action history
    const actionsRes = await pool.query(
      `SELECT 
         a.*,
         u.id AS u_id, u.first_name AS u_first_name, u.last_name AS u_last_name, u.email AS u_email
       FROM approval_workflow_actions a
       JOIN users u ON a.actor_user_id = u.id
       WHERE a.workflow_id = $1
       ORDER BY a.created_at ASC;`,
      [wf.id]
    );
    wf.actions = actionsRes.rows;

    return mapWorkflowRow(wf);
  },

  /**
   * 3. Record a Workflow Action (Manager / HR / Employee Action)
   */
  async recordAction(workflowId, actionData) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const wfRes = await client.query(
        `SELECT * FROM approval_workflows WHERE id = $1;`,
        [workflowId]
      );
      if (!wfRes.rows[0]) {
        throw new Error('Approval workflow not found.');
      }
      const wf = wfRes.rows[0];

      const actionId = actionData.id || `wfa-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const actionQuery = `
        INSERT INTO approval_workflow_actions (
          id, workflow_id, entity_type, entity_id, stage,
          actor_user_id, actor_role, action, from_status, to_status, comments
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *;
      `;
      const actionValues = [
        actionId,
        wf.id,
        wf.entity_type,
        wf.entity_id,
        actionData.stage,
        actionData.actorUserId,
        actionData.actorRole,
        actionData.action,
        actionData.fromStatus,
        actionData.toStatus,
        actionData.comments || '',
      ];
      await client.query(actionQuery, actionValues);

      // Update parent workflow state
      const updateFields = [
        'current_stage = $2',
        'current_status = $3',
      ];
      const updateValues = [workflowId, actionData.nextStage || wf.current_stage, actionData.toStatus];
      let paramIdx = 4;

      if (actionData.toStatus === 'APPROVED' || actionData.toStatus === 'REJECTED') {
        updateFields.push('completed_at = NOW()');
      }

      if (actionData.hrUserId) {
        updateFields.push(`hr_user_id = $${paramIdx++}`);
        updateValues.push(actionData.hrUserId);
      }

      const updateQuery = `
        UPDATE approval_workflows
        SET ${updateFields.join(', ')}
        WHERE id = $1
        RETURNING *;
      `;
      const updatedWfRes = await client.query(updateQuery, updateValues);

      await client.query('COMMIT');
      return this.findByEntity(wf.entity_type, wf.entity_id);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * 4. Query Pending Approvals Queue
   */
  async findPendingQueue(orgId, { managerEmployeeId = null, isHrOrAdmin = false, entityType = null } = {}) {
    const conditions = ['w.org_id = $1'];
    const values = [orgId];
    let idx = 2;

    if (entityType) {
      conditions.push(`w.entity_type = $${idx++}`);
      values.push(entityType);
    }

    if (!isHrOrAdmin && managerEmployeeId) {
      // Manager sees direct reports at MANAGER_REVIEW stage
      conditions.push(`w.manager_id = $${idx++} AND w.current_stage = 'MANAGER_REVIEW'`);
      values.push(managerEmployeeId);
    } else if (isHrOrAdmin) {
      // HR sees all items at HR_REVIEW stage (and optionally all active workflows)
      conditions.push(`w.current_stage IN ('HR_REVIEW', 'MANAGER_REVIEW')`);
    }

    const query = `
      SELECT 
        w.*,
        req.id AS req_id, req.employee_code AS req_code, req.first_name AS req_first_name, req.last_name AS req_last_name, req.email AS req_email,
        mgr.id AS mgr_id, mgr.employee_code AS mgr_code, mgr.first_name AS mgr_first_name, mgr.last_name AS mgr_last_name, mgr.email AS mgr_email
      FROM approval_workflows w
      JOIN employees req ON w.requester_id = req.id
      LEFT JOIN employees mgr ON w.manager_id = mgr.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY w.created_at DESC;
    `;
    const { rows } = await pool.query(query, values);
    return rows.map(mapWorkflowRow);
  },

  /**
   * 5. Get Immutable Audit Log for an Entity
   */
  async getAuditLog(entityType, entityId) {
    const query = `
      SELECT 
        a.*,
        u.first_name AS u_first_name, u.last_name AS u_last_name, u.email AS u_email
      FROM approval_workflow_actions a
      JOIN users u ON a.actor_user_id = u.id
      WHERE a.entity_type = $1 AND a.entity_id = $2
      ORDER BY a.created_at ASC;
    `;
    const { rows } = await pool.query(query, [entityType, entityId]);
    return rows.map((r) => ({
      id: r.id,
      stage: r.stage,
      actorUserId: r.actor_user_id,
      actorName: `${r.u_first_name || ''} ${r.u_last_name || ''}`.trim(),
      actorEmail: r.u_email,
      actorRole: r.actor_role,
      action: r.action,
      fromStatus: r.from_status,
      toStatus: r.to_status,
      comments: r.comments || '',
      timestamp: new Date(r.created_at).toISOString(),
    }));
  },
};

export default workflowRepository;

