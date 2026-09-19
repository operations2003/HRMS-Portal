import { query } from '../config/db.js';
import { adminService } from './adminService.js';
import { notificationService } from './notificationService.js';

export const trainingService = {
  /**
   * Course catalogue
   */
  async listCourses(orgId, filters = {}) {
    let sql = `SELECT * FROM courses WHERE org_id = $1`;
    const params = [orgId];

    if (filters.category) {
      params.push(filters.category);
      sql += ` AND category = $${params.length}`;
    }
    if (filters.status) {
      params.push(filters.status);
      sql += ` AND status = $${params.length}`;
    } else {
      sql += ` AND status = 'ACTIVE'`;
    }
    if (filters.search) {
      params.push(`%${filters.search.toLowerCase()}%`);
      sql += ` AND (LOWER(title) LIKE $${params.length} OR LOWER(description) LIKE $${params.length})`;
    }

    sql += ` ORDER BY is_mandatory DESC, title ASC;`;
    const res = await query(sql, params);
    return res.rows;
  },

  /**
   * Create course (HR / Admin)
   */
  async createCourse(orgId, currentUser, payload) {
    const id = `crs-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const res = await query(
      `INSERT INTO courses (id, org_id, title, description, category, duration_hours, is_mandatory, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', NOW(), NOW())
       RETURNING *;`,
      [
        id,
        orgId,
        payload.title,
        payload.description || '',
        payload.category || 'TECHNICAL',
        parseFloat(payload.durationHours) || 1.0,
        payload.isMandatory === true || payload.isMandatory === 'true',
      ]
    );

    await adminService.logAction({
      orgId,
      actorUserId: currentUser.id,
      actorRole: currentUser.roleName,
      targetType: 'COURSE',
      targetId: id,
      action: 'CREATE_COURSE',
      details: { title: payload.title, category: payload.category },
    }).catch(() => {});

    return res.rows[0];
  },

  /**
   * Enroll employee in course (Self-service, Manager nomination, or HR assignment)
   */
  async enroll(orgId, currentUser, payload) {
    const courseId = payload.courseId;
    const employeeId = payload.employeeId || currentUser.employeeId;
    const enrollmentType = payload.enrollmentType || 'OPTIONAL'; // MANDATORY, OPTIONAL, NOMINATED

    if (!employeeId) {
      const err = new Error('Employee ID is required for enrollment.');
      err.statusCode = 400;
      throw err;
    }

    // Verify course exists
    const courseRes = await query('SELECT * FROM courses WHERE id = $1 AND org_id = $2;', [courseId, orgId]);
    if (courseRes.rows.length === 0) {
      const err = new Error('Course not found.');
      err.statusCode = 404;
      throw err;
    }
    const course = courseRes.rows[0];

    const id = `enr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const res = await query(
      `INSERT INTO course_enrollments (
        id, org_id, course_id, employee_id, assigned_by, enrollment_type,
        status, progress_percentage, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'ENROLLED', 0, NOW(), NOW())
      ON CONFLICT (course_id, employee_id) DO UPDATE 
      SET status = EXCLUDED.status, updated_at = NOW()
      RETURNING *;`,
      [id, orgId, courseId, employeeId, currentUser.id, enrollmentType]
    );

    // Notify employee if assigned by someone else
    if (employeeId !== currentUser.employeeId) {
      const empRes = await query('SELECT user_id FROM employees WHERE id = $1;', [employeeId]);
      if (empRes.rows[0]?.user_id) {
        await notificationService.createNotification({
          orgId,
          userId: empRes.rows[0].user_id,
          eventType: 'TRAINING_ASSIGNED',
          title: `New Training Assigned: ${course.title}`,
          message: `You have been enrolled in the course "${course.title}".`,
          entityType: 'COURSE',
          entityId: courseId,
        }).catch(() => {});
      }
    }

    return res.rows[0];
  },

  /**
   * Update enrollment progress / complete training
   */
  async updateProgress(enrollmentId, orgId, currentUser, payload) {
    const enrRes = await query('SELECT * FROM course_enrollments WHERE id = $1 AND org_id = $2;', [enrollmentId, orgId]);
    if (enrRes.rows.length === 0) {
      const err = new Error('Enrollment record not found.');
      err.statusCode = 404;
      throw err;
    }
    const enr = enrRes.rows[0];

    // Authorize: employee themselves or HR/Admin
    const isOwner = currentUser.employeeId && enr.employee_id === currentUser.employeeId;
    const isPrivileged = currentUser.roleName && ['admin', 'superadmin', 'orgadmin', 'hr', 'hrmanager'].includes(currentUser.roleName.toLowerCase());
    if (!isOwner && !isPrivileged) {
      const err = new Error('Access denied: You cannot update another employee enrollment.');
      err.statusCode = 403;
      throw err;
    }

    const progress = Math.min(100, Math.max(0, parseInt(payload.progressPercentage ?? enr.progress_percentage, 10)));
    let status = payload.status || enr.status;
    let completionDate = enr.completion_date;

    if (progress === 100 || status === 'COMPLETED') {
      status = 'COMPLETED';
      completionDate = completionDate || new Date().toISOString().split('T')[0];
    }

    const res = await query(
      `UPDATE course_enrollments
       SET progress_percentage = $1, status = $2, completion_date = $3,
           certificate_url = COALESCE($4, certificate_url),
           feedback_rating = COALESCE($5, feedback_rating),
           feedback_comments = COALESCE($6, feedback_comments),
           updated_at = NOW()
       WHERE id = $7
       RETURNING *;`,
      [progress, status, completionDate, payload.certificateUrl || null, payload.feedbackRating || null, payload.feedbackComments || null, enrollmentId]
    );

    return res.rows[0];
  },

  /**
   * List enrollments for an employee or organization
   */
  async listEnrollments(orgId, filters = {}) {
    let sql = `
      SELECT ce.*, c.title AS course_title, c.description AS course_description,
             c.category AS course_category, c.duration_hours, c.is_mandatory,
             e.first_name, e.last_name, e.employee_code, e.email,
             d.name AS department_name
      FROM course_enrollments ce
      JOIN courses c ON ce.course_id = c.id
      JOIN employees e ON ce.employee_id = e.id
      LEFT JOIN departments d ON e.dept_id = d.id
      WHERE ce.org_id = $1
    `;
    const params = [orgId];

    if (filters.employeeId) {
      params.push(filters.employeeId);
      sql += ` AND ce.employee_id = $${params.length}`;
    }
    if (filters.status) {
      params.push(filters.status);
      sql += ` AND ce.status = $${params.length}`;
    }
    if (filters.category) {
      params.push(filters.category);
      sql += ` AND c.category = $${params.length}`;
    }

    sql += ` ORDER BY ce.status = 'ENROLLED' DESC, ce.created_at DESC;`;
    const res = await query(sql, params);
    return res.rows;
  },

  /**
   * Employee skill matrix
   */
  async getSkillMatrix(orgId, employeeId) {
    const res = await query(
      `SELECT es.*, e.first_name, e.last_name, e.employee_code, d.name AS department_name
       FROM employee_skills es
       JOIN employees e ON es.employee_id = e.id
       LEFT JOIN departments d ON e.dept_id = d.id
       WHERE es.org_id = $1 AND ($2::varchar IS NULL OR es.employee_id = $2)
       ORDER BY es.skill_name ASC;`,
      [orgId, employeeId || null]
    );
    return res.rows;
  },

  /**
   * Add or update employee skill
   */
  async upsertSkill(orgId, currentUser, payload) {
    const employeeId = payload.employeeId || currentUser.employeeId;
    const skillName = payload.skillName?.trim();
    const level = payload.proficiencyLevel || 'INTERMEDIATE';

    if (!skillName) {
      const err = new Error('Skill name is required.');
      err.statusCode = 400;
      throw err;
    }

    const id = `skl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const res = await query(
      `INSERT INTO employee_skills (id, org_id, employee_id, skill_name, proficiency_level, verified_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (employee_id, skill_name) DO UPDATE
       SET proficiency_level = EXCLUDED.proficiency_level, verified_by = EXCLUDED.verified_by, updated_at = NOW()
       RETURNING *;`,
      [id, orgId, employeeId, skillName, level, currentUser.id]
    );

    return res.rows[0];
  },
};

