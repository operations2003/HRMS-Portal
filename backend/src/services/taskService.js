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

  /**
   * Get employee's personal work performance metrics
   */
  async getMyPerformance(orgId, currentUser, timeframe = 'this_month') {
    let empId = currentUser.employeeId;
    if (!empId) {
      const eRes = await query('SELECT id FROM employees WHERE user_id = $1 AND org_id = $2;', [currentUser.id, orgId]);
      if (eRes.rows[0]) {
        empId = eRes.rows[0].id;
      }
    }

    if (!empId) {
      return {
        performanceScore: 0,
        performanceStatus: 'Needs Improvement',
        totalTasks: 0,
        completedTasks: 0,
        createdTasks: 0,
        completionRate: 0,
        onTimeDelivery: 0,
        averageRating: 0,
        ratingCount: 0,
        firstTimeCompletion: 0,
        tasksReopened: 0,
        reopenRate: 0,
        overdueTasks: 0,
        priority: { high: 0, medium: 0, low: 0 },
        last30DaysTrend: [],
      };
    }

    // Determine timeframe boundaries
    const now = new Date();
    let startDate = null;
    const tf = (timeframe || '').toLowerCase().replace(/[\s-]/g, '_');

    if (tf === 'this_week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      startDate = new Date(now.setDate(diff));
      startDate.setHours(0, 0, 0, 0);
    } else if (tf === 'last_month') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    } else if (tf === 'this_quarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      startDate = new Date(now.getFullYear(), qMonth, 1);
    } else if (tf === 'this_year') {
      startDate = new Date(now.getFullYear(), 0, 1);
    } else if (tf === 'all_time') {
      startDate = null;
    } else {
      // Default: this_month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    let sql = `
      SELECT t.*,
             CASE 
               WHEN t.status != 'COMPLETED' AND t.status != 'CANCELLED' AND t.due_date < CURRENT_DATE THEN true
               ELSE false
             END AS is_overdue
      FROM work_tasks t
      WHERE t.org_id = $1 AND (t.assignee_id = $2 OR t.creator_id = $2)
    `;
    const params = [orgId, empId];

    if (startDate) {
      params.push(startDate.toISOString());
      sql += ` AND t.created_at >= $${params.length}`;
    }

    const res = await query(sql, params);
    const tasks = res.rows;

    const assignedTasks = tasks.filter((t) => t.assignee_id === empId);
    const totalTasks = assignedTasks.length;
    const createdTasks = tasks.filter((t) => t.creator_id === empId).length;
    const completedTasks = assignedTasks.filter((t) => t.status === 'COMPLETED').length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const onTimeTasks = assignedTasks.filter((t) => {
      if (t.status !== 'COMPLETED') return false;
      if (!t.due_date) return true;
      const compDate = new Date(t.updated_at);
      const dueDate = new Date(t.due_date);
      dueDate.setHours(23, 59, 59, 999);
      return compDate <= dueDate;
    }).length;
    const onTimeDelivery = completedTasks > 0 ? Math.round((onTimeTasks / completedTasks) * 100) : 0;

    const firstTimeTasks = assignedTasks.filter((t) => {
      if (t.status !== 'COMPLETED') return false;
      const commentsStr = JSON.stringify(t.comments || []);
      return !commentsStr.toLowerCase().includes('reopen') && !commentsStr.toLowerCase().includes('rejected');
    }).length;
    const firstTimeCompletion = completedTasks > 0 ? Math.round((firstTimeTasks / completedTasks) * 100) : 0;

    const tasksReopened = assignedTasks.filter((t) => {
      const commentsStr = JSON.stringify(t.comments || []);
      return commentsStr.toLowerCase().includes('reopen') || t.status === 'BLOCKED';
    }).length;
    const reopenRate = totalTasks > 0 ? Math.round((tasksReopened / totalTasks) * 100) : 0;

    const overdueTasks = assignedTasks.filter((t) => t.is_overdue).length;

    // Priority breakdown for assigned tasks
    const priority = {
      high: assignedTasks.filter((t) => t.priority === 'HIGH' || t.priority === 'URGENT').length,
      medium: assignedTasks.filter((t) => t.priority === 'MEDIUM').length,
      low: assignedTasks.filter((t) => t.priority === 'LOW').length,
    };

    // Calculate dynamic performance score
    let performanceScore = 0;
    let performanceStatus = 'Needs Improvement';

    if (totalTasks > 0) {
      performanceScore = Math.min(
        100,
        Math.max(
          0,
          Math.round(
            completionRate * 0.4 +
            onTimeDelivery * 0.35 +
            firstTimeCompletion * 0.25 -
            (overdueTasks / totalTasks) * 20
          )
        )
      );

      if (performanceScore >= 85) performanceStatus = 'Outstanding';
      else if (performanceScore >= 70) performanceStatus = 'Good';
      else if (performanceScore >= 50) performanceStatus = 'Satisfactory';
      else performanceStatus = 'Needs Improvement';
    }

    // Generate last 30 days completed tasks distribution
    const last30DaysTrend = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ymd = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

      const dayCompleted = assignedTasks.filter((t) => {
        if (t.status !== 'COMPLETED') return false;
        const compYmd = new Date(t.updated_at).toISOString().split('T')[0];
        return compYmd === ymd;
      }).length;

      last30DaysTrend.push({
        date: ymd,
        label,
        completed: dayCompleted,
      });
    }

    return {
      performanceScore,
      performanceStatus,
      totalTasks,
      completedTasks,
      createdTasks,
      completionRate,
      onTimeDelivery,
      averageRating: 0,
      ratingCount: 0,
      firstTimeCompletion,
      tasksReopened,
      reopenRate,
      overdueTasks,
      priority,
      last30DaysTrend,
    };
  },
};

