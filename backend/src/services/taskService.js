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
             r.first_name AS rater_first, r.last_name AS rater_last,
             d.name AS department_name,
             CASE 
               WHEN t.status != 'COMPLETED' AND t.status != 'CANCELLED' AND t.due_date < CURRENT_DATE THEN true
               ELSE false
             END AS is_overdue
      FROM work_tasks t
      JOIN employees c ON t.creator_id = c.id
      JOIN employees a ON t.assignee_id = a.id
      LEFT JOIN employees r ON t.rated_by = r.id
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
    const normRole = (currentUser.roleName || '').toLowerCase();
    const allowedAssignerRoles = ['admin', 'superadmin', 'orgadmin', 'hr', 'hrmanager', 'manager'];
    if (!allowedAssignerRoles.includes(normRole)) {
      const err = new Error('Access denied: Only Admin, HR, and Manager can create and assign tasks.');
      err.statusCode = 403;
      throw err;
    }

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
   * Rate a completed task (Admin, HR, Manager only)
   */
  async rateTask(taskId, orgId, currentUser, { rating, feedback }) {
    const normRole = (currentUser.roleName || '').toLowerCase();
    const allowedAssignerRoles = ['admin', 'superadmin', 'orgadmin', 'hr', 'hrmanager', 'manager'];
    if (!allowedAssignerRoles.includes(normRole)) {
      const err = new Error('Access denied: Only Admin, HR, and Manager can rate completed tasks.');
      err.statusCode = 403;
      throw err;
    }

    const taskRes = await query('SELECT * FROM work_tasks WHERE id = $1 AND org_id = $2;', [taskId, orgId]);
    if (taskRes.rows.length === 0) {
      const err = new Error('Task not found.');
      err.statusCode = 404;
      throw err;
    }

    const task = taskRes.rows[0];

    // Only completed tasks can be rated
    if (task.status !== 'COMPLETED') {
      const err = new Error('Only completed tasks can be reviewed and rated.');
      err.statusCode = 400;
      throw err;
    }

    const numRating = parseFloat(rating);
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
      const err = new Error('Rating must be a number between 1.0 and 5.0.');
      err.statusCode = 400;
      throw err;
    }

    // Resolve rater employee ID
    let raterEmpId = currentUser.employeeId;
    if (!raterEmpId) {
      const eRes = await query('SELECT id FROM employees WHERE user_id = $1 AND org_id = $2;', [currentUser.id, orgId]);
      if (eRes.rows[0]) raterEmpId = eRes.rows[0].id;
    }

    const raterName = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.name || 'Manager';
    const cleanFeedback = feedback ? feedback.trim() : null;

    // Append rating event to comments
    const comments = task.comments || [];
    comments.push({
      id: `comment-rating-${Date.now()}`,
      authorName: raterName,
      authorId: currentUser.id,
      text: `[TASK_RATED] Rated ${numRating} / 5 stars ⭐${cleanFeedback ? ` — Feedback: "${cleanFeedback}"` : ''}`,
      createdAt: new Date().toISOString(),
    });

    const res = await query(
      `UPDATE work_tasks
       SET rating = $1,
           rating_feedback = $2,
           rated_by = $3,
           rated_at = NOW(),
           comments = $4,
           updated_at = NOW()
       WHERE id = $5 AND org_id = $6
       RETURNING *;`,
      [numRating, cleanFeedback, raterEmpId, JSON.stringify(comments), taskId, orgId]
    );

    const updatedTask = res.rows[0];

    // Send notification to assignee
    if (task.assignee_id) {
      const aRes = await query('SELECT user_id FROM employees WHERE id = $1;', [task.assignee_id]);
      if (aRes.rows[0]?.user_id) {
        await notificationService.createNotification({
          orgId,
          userId: aRes.rows[0].user_id,
          eventType: 'TASK_RATED',
          title: `Task Rated: ${numRating}/5 for "${task.title}"`,
          message: `${raterName} rated your completed task ${numRating}/5.${cleanFeedback ? ` Feedback: "${cleanFeedback}"` : ''}`,
          entityType: 'TASK',
          entityId: taskId,
        }).catch(() => {});
      }
    }

    return updatedTask;
  },

  /**
   * Reopen a task for revisions (Admin, HR, Manager only)
   */
  async reopenTask(taskId, orgId, currentUser, { reason }) {
    const normRole = (currentUser.roleName || '').toLowerCase();
    const allowedAssignerRoles = ['admin', 'superadmin', 'orgadmin', 'hr', 'hrmanager', 'manager'];
    if (!allowedAssignerRoles.includes(normRole)) {
      const err = new Error('Access denied: Only Admin, HR, and Manager can reopen tasks.');
      err.statusCode = 403;
      throw err;
    }

    const taskRes = await query('SELECT * FROM work_tasks WHERE id = $1 AND org_id = $2;', [taskId, orgId]);
    if (taskRes.rows.length === 0) {
      const err = new Error('Task not found.');
      err.statusCode = 404;
      throw err;
    }

    const task = taskRes.rows[0];
    const comments = task.comments || [];
    const reviewerName = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.name || 'Manager';
    const reopenNote = reason && reason.trim() ? reason.trim() : 'Task reopened for revisions and completion.';

    comments.push({
      id: `comment-reopen-${Date.now()}`,
      authorName: reviewerName,
      authorId: currentUser.id,
      text: `[TASK_REOPENED] ${reopenNote}`,
      createdAt: new Date().toISOString(),
    });

    const res = await query(
      `UPDATE work_tasks
       SET status = 'IN_PROGRESS',
           reopen_count = COALESCE(reopen_count, 0) + 1,
           rating = NULL,
           rating_feedback = NULL,
           comments = $1,
           updated_at = NOW()
       WHERE id = $2 AND org_id = $3
       RETURNING *;`,
      [JSON.stringify(comments), taskId, orgId]
    );

    const updatedTask = res.rows[0];

    // Send notification to assignee
    if (task.assignee_id) {
      const aRes = await query('SELECT user_id FROM employees WHERE id = $1;', [task.assignee_id]);
      if (aRes.rows[0]?.user_id) {
        await notificationService.createNotification({
          orgId,
          userId: aRes.rows[0].user_id,
          eventType: 'TASK_REOPENED',
          title: `Task Reopened: "${task.title}"`,
          message: `${reviewerName} reopened your task for revisions: "${reopenNote}"`,
          entityType: 'TASK',
          entityId: taskId,
        }).catch(() => {});
      }
    }

    return updatedTask;
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

    // Rated tasks & average rating calculation
    const ratedTasks = assignedTasks.filter((t) => t.rating != null && Number(t.rating) > 0);
    const totalRating = ratedTasks.reduce((sum, t) => sum + Number(t.rating), 0);
    const averageRating = ratedTasks.length > 0 ? parseFloat((totalRating / ratedTasks.length).toFixed(1)) : 0;
    const ratingCount = ratedTasks.length;

    // First time completion (completed with 0 reopens)
    const firstTimeTasks = assignedTasks.filter((t) => {
      if (t.status !== 'COMPLETED') return false;
      return !t.reopen_count || Number(t.reopen_count) === 0;
    }).length;
    const firstTimeCompletion = completedTasks > 0 ? Math.round((firstTimeTasks / completedTasks) * 100) : 0;

    // Tasks reopened
    const tasksReopened = assignedTasks.filter((t) => Number(t.reopen_count || 0) > 0).length;
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
      const ratingNormalized = ratedTasks.length > 0 ? (averageRating / 5) * 100 : completionRate;
      performanceScore = Math.min(
        100,
        Math.max(
          0,
          Math.round(
            completionRate * 0.3 +
            onTimeDelivery * 0.25 +
            firstTimeCompletion * 0.25 +
            ratingNormalized * 0.2 -
            (overdueTasks / totalTasks) * 15
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
      averageRating,
      ratingCount,
      firstTimeCompletion,
      tasksReopened,
      reopenRate,
      overdueTasks,
      priority,
      last30DaysTrend,
    };
  },
};

