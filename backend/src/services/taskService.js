import { query } from '../config/db.js';
import { adminService } from './adminService.js';
import { notificationService } from './notificationService.js';

export const taskService = {
  /**
   * List tasks for an organization with rich filtering
   */
  async listTasks(orgId, currentUser, filters = {}) {
    let sql = `
      SELECT t.*,
             c.first_name AS creator_first, c.last_name AS creator_last, c.employee_code AS creator_code,
             a.first_name AS assignee_first, a.last_name AS assignee_last, a.employee_code AS assignee_code,
             d.name AS department_name,
             CASE 
               WHEN t.status != 'COMPLETED' AND t.status != 'CANCELLED' AND t.due_date < CURRENT_DATE THEN true
               ELSE false
             END AS is_overdue
      FROM work_tasks t
      JOIN employees c ON t.creator_id = c.id
      JOIN employees a ON t.assignee_id = a.id
      LEFT JOIN departments d ON t.dept_id = d.id
      WHERE t.org_id = $1
    `;
    const params = [orgId];

    // Role-based visibility: standard employees see assigned or created tasks
    const isPrivileged = currentUser.roleName && ['admin', 'superadmin', 'orgadmin', 'hr', 'hrmanager'].includes(currentUser.roleName.toLowerCase());
    const isManager = (currentUser.roleName || '').toLowerCase() === 'manager';

    if (!isPrivileged && currentUser.employeeId) {
      if (isManager) {
        params.push(currentUser.employeeId);
        sql += ` AND (t.assignee_id = $${params.length} OR t.creator_id = $${params.length} OR a.manager_id = $${params.length})`;
      } else {
        params.push(currentUser.employeeId);
        sql += ` AND (t.assignee_id = $${params.length} OR t.creator_id = $${params.length})`;
      }
    }

    if (filters.status) {
      params.push(filters.status);
      sql += ` AND t.status = $${params.length}`;
    }
    if (filters.priority) {
      params.push(filters.priority);
      sql += ` AND t.priority = $${params.length}`;
    }
    if (filters.assigneeId) {
      params.push(filters.assigneeId);
      sql += ` AND t.assignee_id = $${params.length}`;
    }
    if (filters.search) {
      params.push(`%${filters.search.toLowerCase()}%`);
      sql += ` AND (LOWER(t.title) LIKE $${params.length} OR LOWER(t.description) LIKE $${params.length})`;
    }

    sql += ` ORDER BY is_overdue DESC, t.due_date ASC NULLS LAST, t.created_at DESC;`;

    const res = await query(sql, params);
    return res.rows;
  },

  /**
   * Create task
   */
  async createTask(orgId, currentUser, payload) {
    const creatorId = currentUser.employeeId;
    if (!creatorId) {
      const err = new Error('You must be linked to an employee profile to create tasks.');
      err.statusCode = 400;
      throw err;
    }

    const id = `tsk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const assigneeId = payload.assigneeId || creatorId;

    const res = await query(
      `INSERT INTO work_tasks (
        id, org_id, title, description, creator_id, assignee_id, dept_id,
        priority, status, due_date, subtasks, comments, attachments, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'TODO', $9, $10, $11, $12, NOW(), NOW())
      RETURNING *;`,
      [
        id,
        orgId,
        payload.title,
        payload.description || '',
        creatorId,
        assigneeId,
        payload.deptId || null,
        payload.priority || 'MEDIUM',
        payload.dueDate || null,
        JSON.stringify(payload.subtasks || []),
        JSON.stringify([]),
        JSON.stringify(payload.attachments || []),
      ]
    );

    const task = res.rows[0];

    // Notify assignee
    if (assigneeId !== creatorId) {
      const aRes = await query('SELECT user_id FROM employees WHERE id = $1;', [assigneeId]);
      if (aRes.rows[0]?.user_id) {
        await notificationService.createNotification({
          orgId,
          userId: aRes.rows[0].user_id,
          eventType: 'TASK_ASSIGNED',
          title: `New Task Assigned: ${task.title}`,
          message: `${currentUser.firstName} assigned you a task with priority '${task.priority}'. Due: ${task.due_date || 'N/A'}.`,
          entityType: 'TASK',
          entityId: id,
        }).catch(() => {});
      }
    }

    return task;
  },

  /**
   * Update task status (e.g. from Kanban drag or status dropdown)
   */
  async updateStatus(taskId, orgId, currentUser, status) {
    const validStatuses = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      const err = new Error(`Invalid status '${status}'. Must be one of ${validStatuses.join(', ')}.`);
      err.statusCode = 400;
      throw err;
    }

    const res = await query(
      `UPDATE work_tasks 
       SET status = $1, updated_at = NOW() 
       WHERE id = $2 AND org_id = $3
       RETURNING *;`,
      [status, taskId, orgId]
    );

    if (res.rows.length === 0) {
      const err = new Error('Task not found.');
      err.statusCode = 404;
      throw err;
    }

    return res.rows[0];
  },

  /**
   * Add comment to task
   */
  async addComment(taskId, orgId, currentUser, text) {
    const taskRes = await query('SELECT comments FROM work_tasks WHERE id = $1 AND org_id = $2;', [taskId, orgId]);
    if (taskRes.rows.length === 0) {
      const err = new Error('Task not found.');
      err.statusCode = 404;
      throw err;
    }

    const comments = taskRes.rows[0].comments || [];
    comments.push({
      id: `comment-${Date.now()}`,
      authorName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      authorId: currentUser.id,
      text,
      createdAt: new Date().toISOString(),
    });

    const res = await query(
      `UPDATE work_tasks 
       SET comments = $1, updated_at = NOW() 
       WHERE id = $2 AND org_id = $3 
       RETURNING *;`,
      [JSON.stringify(comments), taskId, orgId]
    );

    return res.rows[0];
  },

  /**
   * Toggle subtask completion
   */
  async updateSubtasks(taskId, orgId, subtasks) {
    const res = await query(
      `UPDATE work_tasks 
       SET subtasks = $1, updated_at = NOW() 
       WHERE id = $2 AND org_id = $3 
       RETURNING *;`,
      [JSON.stringify(subtasks), taskId, orgId]
    );
    if (res.rows.length === 0) {
      const err = new Error('Task not found.');
      err.statusCode = 404;
      throw err;
    }
    return res.rows[0];
  },
};

