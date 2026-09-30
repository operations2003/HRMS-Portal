import { query } from '../config/db.js';
import { adminService } from './adminService.js';
import { notificationService } from './notificationService.js';
import { cloudinaryService } from './cloudinaryService.js';

export const trainingService = {
  /**
   * Course catalogue
   * - Training managers see all courses (published, unpublished, draft, active, inactive)
   * - Standard staff only see PUBLISHED or ACTIVE courses
   */
  async listCourses(orgId, filters = {}, isTrainingManager = false) {
    let sql = `SELECT * FROM courses WHERE org_id = $1`;
    const params = [orgId];

    if (filters.category) {
      params.push(filters.category);
      sql += ` AND category = $${params.length}`;
    }
    if (filters.status) {
      params.push(filters.status);
      sql += ` AND status = $${params.length}`;
    } else if (!isTrainingManager) {
      // Non-managers only see published/active courses
      sql += ` AND status IN ('ACTIVE', 'PUBLISHED')`;
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
   * Get course by ID
   */
  async getCourseById(courseId, orgId) {
    const res = await query('SELECT * FROM courses WHERE id = $1 AND org_id = $2;', [courseId, orgId]);
    if (res.rows.length === 0) {
      const err = new Error('Course not found.');
      err.statusCode = 404;
      throw err;
    }
    return res.rows[0];
  },

  /**
   * Create course (Admin OR HR in Learning & Development)
   */
  async createCourse(orgId, currentUser, payload) {
    const id = `crs-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const status = payload.status || 'PUBLISHED';
    const trainingLink = (payload.trainingLink || payload.training_link || '').trim();
    const postedBy = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.email;

    const res = await query(
      `INSERT INTO courses (
        id, org_id, title, description, category, duration_hours, is_mandatory,
        status, training_link, posted_by, created_by_user_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *;`,
      [
        id,
        orgId,
        payload.title,
        payload.description || '',
        payload.category || 'TECHNICAL',
        parseFloat(payload.durationHours || payload.duration_hours) || 1.0,
        payload.isMandatory === true || payload.isMandatory === 'true',
        status,
        trainingLink,
        postedBy,
        currentUser.id,
      ]
    );

    await adminService.logAction({
      orgId,
      actorUserId: currentUser.id,
      actorRole: currentUser.roleName,
      targetType: 'COURSE',
      targetId: id,
      action: 'CREATE_COURSE',
      details: { title: payload.title, category: payload.category, status, trainingLink },
    }).catch(() => {});

    return res.rows[0];
  },

  /**
   * Update existing course
   */
  async updateCourse(courseId, orgId, currentUser, payload) {
    const existing = await query('SELECT * FROM courses WHERE id = $1 AND org_id = $2;', [courseId, orgId]);
    if (existing.rows.length === 0) {
      const err = new Error('Course not found.');
      err.statusCode = 404;
      throw err;
    }

    const title = payload.title !== undefined ? payload.title : existing.rows[0].title;
    const description = payload.description !== undefined ? payload.description : existing.rows[0].description;
    const category = payload.category !== undefined ? payload.category : existing.rows[0].category;
    const durationHours = payload.durationHours !== undefined 
      ? parseFloat(payload.durationHours) 
      : (payload.duration_hours !== undefined ? parseFloat(payload.duration_hours) : existing.rows[0].duration_hours);
    const isMandatory = payload.isMandatory !== undefined 
      ? (payload.isMandatory === true || payload.isMandatory === 'true') 
      : existing.rows[0].is_mandatory;
    const status = payload.status !== undefined ? payload.status : existing.rows[0].status;
    const trainingLink = payload.trainingLink !== undefined 
      ? payload.trainingLink 
      : (payload.training_link !== undefined ? payload.training_link : existing.rows[0].training_link);

    const res = await query(
      `UPDATE courses 
       SET title = $1, description = $2, category = $3, duration_hours = $4,
           is_mandatory = $5, status = $6, training_link = $7, updated_at = NOW()
       WHERE id = $8 AND org_id = $9
       RETURNING *;`,
      [title, description, category, durationHours, isMandatory, status, trainingLink, courseId, orgId]
    );

    await adminService.logAction({
      orgId,
      actorUserId: currentUser.id,
      actorRole: currentUser.roleName,
      targetType: 'COURSE',
      targetId: courseId,
      action: 'UPDATE_COURSE',
      details: { title, status, trainingLink },
    }).catch(() => {});

    return res.rows[0];
  },

  /**
   * Publish course
   */
  async publishCourse(courseId, orgId, currentUser) {
    return this.updateCourse(courseId, orgId, currentUser, { status: 'PUBLISHED' });
  },

  /**
   * Unpublish / Deactivate course
   */
  async unpublishCourse(courseId, orgId, currentUser) {
    return this.updateCourse(courseId, orgId, currentUser, { status: 'UNPUBLISHED' });
  },

  /**
   * Delete course if permitted
   */
  async deleteCourse(courseId, orgId, currentUser) {
    const existing = await query('SELECT * FROM courses WHERE id = $1 AND org_id = $2;', [courseId, orgId]);
    if (existing.rows.length === 0) {
      const err = new Error('Course not found.');
      err.statusCode = 404;
      throw err;
    }

    // Delete associated enrollments
    await query('DELETE FROM course_enrollments WHERE course_id = $1 AND org_id = $2;', [courseId, orgId]);
    // Delete course
    await query('DELETE FROM courses WHERE id = $1 AND org_id = $2;', [courseId, orgId]);

    await adminService.logAction({
      orgId,
      actorUserId: currentUser.id,
      actorRole: currentUser.roleName,
      targetType: 'COURSE',
      targetId: courseId,
      action: 'DELETE_COURSE',
      details: { title: existing.rows[0].title },
    }).catch(() => {});

    return { message: 'Course deleted successfully.', id: courseId };
  },

  /**
   * View all training completion and progress data for a specific course across all active staff
   */
  async getCourseCompletionMatrix(orgId, courseId) {
    const courseRes = await query('SELECT * FROM courses WHERE id = $1 AND org_id = $2;', [courseId, orgId]);
    if (courseRes.rows.length === 0) {
      const err = new Error('Course not found.');
      err.statusCode = 404;
      throw err;
    }
    const course = courseRes.rows[0];

    const sql = `
      SELECT 
        e.id AS employee_id,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.email,
        d.name AS department_name,
        des.title AS designation_name,
        ce.id AS enrollment_id,
        ce.status AS enrollment_status,
        ce.progress_percentage,
        ce.completion_date,
        ce.enrollment_type,
        ce.assigned_by,
        ce.certificate_url,
        ce.feedback_rating,
        ce.feedback_comments,
        ce.created_at AS assigned_at,
        CASE
          WHEN ce.status = 'COMPLETED' OR ce.progress_percentage = 100 THEN 'COMPLETED'
          WHEN ce.status = 'IN_PROGRESS' OR (ce.progress_percentage > 0 AND ce.progress_percentage < 100) THEN 'IN_PROGRESS'
          WHEN ce.id IS NOT NULL THEN 'ENROLLED'
          ELSE 'NOT_ENROLLED'
        END AS progress_status
      FROM employees e
      LEFT JOIN departments d ON e.dept_id = d.id
      LEFT JOIN designations des ON e.desig_id = des.id
      LEFT JOIN course_enrollments ce ON ce.employee_id = e.id AND ce.course_id = $1
      WHERE e.org_id = $2 AND e.status = 'Active'
      ORDER BY 
        CASE 
          WHEN ce.status = 'COMPLETED' OR ce.progress_percentage = 100 THEN 1
          WHEN ce.status = 'IN_PROGRESS' THEN 2
          WHEN ce.id IS NOT NULL THEN 3
          ELSE 4
        END,
        e.first_name ASC;
    `;
    const res = await query(sql, [courseId, orgId]);

    const totalEmployees = res.rows.length;
    const completedCount = res.rows.filter(r => r.progress_status === 'COMPLETED').length;
    const inProgressCount = res.rows.filter(r => r.progress_status === 'IN_PROGRESS').length;
    const enrolledNotStartedCount = res.rows.filter(r => r.progress_status === 'ENROLLED').length;
    const notEnrolledCount = res.rows.filter(r => r.progress_status === 'NOT_ENROLLED').length;
    const enrolledCount = totalEmployees - notEnrolledCount;
    const notCompletedCount = totalEmployees - completedCount;
    const completionRate = enrolledCount > 0 ? Math.round((completedCount / enrolledCount) * 100) : 0;
    const overallRate = totalEmployees > 0 ? Math.round((completedCount / totalEmployees) * 100) : 0;

    const stats = {
      totalEmployees,
      enrolledCount,
      completedCount,
      inProgressCount,
      enrolledNotStartedCount,
      notEnrolledCount,
      notCompletedCount,
      completionRate,
      overallRate,
    };

    const formattedEmployees = res.rows.map(r => ({
      ...r,
      employeeId: r.employee_id,
      employeeCode: r.employee_code,
      firstName: r.first_name,
      lastName: r.last_name,
      email: r.email,
      departmentName: r.department_name,
      designationTitle: r.designation_name,
      enrollmentId: r.enrollment_id,
      status: r.enrollment_status,
      enrollmentStatus: r.enrollment_status,
      progressPercentage: Number(r.progress_percentage || 0),
      completionDate: r.completion_date,
      completedAt: r.completion_date,
      enrollmentType: r.enrollment_type,
      completionStatus: r.progress_status,
      progressStatus: r.progress_status,
      assignedBy: r.assigned_by,
      assignedAt: r.assigned_at,
    }));

    return {
      course,
      stats,
      summary: stats, // alias for frontend compatibility
      employees: formattedEmployees,
    };
  },

  /**
   * Assign course to employee(s), department, or company-wide (L&D / Training Managers)
   */
  async assignCourse(orgId, currentUser, payload) {
    const { courseId, employeeIds, employeeId, departmentId, departmentIds, targetAll, enrollmentType = 'MANDATORY', notes } = payload;

    // Verify course exists
    const courseRes = await query('SELECT * FROM courses WHERE id = $1 AND org_id = $2;', [courseId, orgId]);
    if (courseRes.rows.length === 0) {
      const err = new Error('Course not found.');
      err.statusCode = 404;
      throw err;
    }
    const course = courseRes.rows[0];

    // Determine target employees
    let employeesToAssign = [];

    if (targetAll === true || targetAll === 'true') {
      const res = await query(
        `SELECT e.id, e.user_id, e.first_name, e.last_name, e.email 
         FROM employees e 
         WHERE e.org_id = $1 AND e.status = 'Active';`,
        [orgId]
      );
      employeesToAssign = res.rows;
    } else if (departmentId || (departmentIds && departmentIds.length > 0)) {
      const deptList = departmentIds && Array.isArray(departmentIds) && departmentIds.length > 0 
        ? departmentIds 
        : [departmentId];
      const res = await query(
        `SELECT e.id, e.user_id, e.first_name, e.last_name, e.email 
         FROM employees e 
         WHERE e.org_id = $1 AND e.dept_id = ANY($2::varchar[]) AND e.status = 'Active';`,
        [orgId, deptList]
      );
      employeesToAssign = res.rows;
    } else if (employeeIds && Array.isArray(employeeIds) && employeeIds.length > 0) {
      const res = await query(
        `SELECT e.id, e.user_id, e.first_name, e.last_name, e.email 
         FROM employees e 
         WHERE e.org_id = $1 AND e.id = ANY($2::varchar[]) AND e.status = 'Active';`,
        [orgId, employeeIds]
      );
      employeesToAssign = res.rows;
    } else if (employeeId) {
      const res = await query(
        `SELECT e.id, e.user_id, e.first_name, e.last_name, e.email 
         FROM employees e 
         WHERE e.org_id = $1 AND e.id = $2 AND e.status = 'Active';`,
        [orgId, employeeId]
      );
      employeesToAssign = res.rows;
    } else {
      const err = new Error('Please select at least one employee, department, or choose all company employees.');
      err.statusCode = 400;
      throw err;
    }

    if (employeesToAssign.length === 0) {
      const err = new Error('No active employees found matching the assignment criteria.');
      err.statusCode = 400;
      throw err;
    }

    const assignedResults = [];
    const validEnrollmentType = ['MANDATORY', 'OPTIONAL', 'NOMINATED'].includes(enrollmentType)
      ? enrollmentType
      : 'MANDATORY';

    for (const emp of employeesToAssign) {
      const enrId = `enr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const res = await query(
        `INSERT INTO course_enrollments (
          id, org_id, course_id, employee_id, assigned_by, enrollment_type,
          status, progress_percentage, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'ENROLLED', 0, NOW(), NOW())
        ON CONFLICT (course_id, employee_id) DO UPDATE 
        SET enrollment_type = EXCLUDED.enrollment_type,
            assigned_by = EXCLUDED.assigned_by,
            updated_at = NOW()
        RETURNING *;`,
        [enrId, orgId, courseId, emp.id, currentUser.id, validEnrollmentType]
      );
      assignedResults.push(res.rows[0]);

      // Notify employee
      if (emp.user_id) {
        await notificationService.createNotification({
          orgId,
          userId: emp.user_id,
          eventType: 'TRAINING_ASSIGNED',
          title: `L&D Course Assigned: ${course.title}`,
          message: `The Learning & Development department has assigned you "${course.title}" (${validEnrollmentType}).`,
          entityType: 'COURSE',
          entityId: courseId,
        }).catch(() => {});
      }
    }

    await adminService.logAction({
      orgId,
      actorUserId: currentUser.id,
      actorRole: currentUser.roleName,
      targetType: 'COURSE_ASSIGNMENT',
      targetId: courseId,
      action: 'ASSIGN_COURSE',
      details: {
        courseTitle: course.title,
        assignedCount: employeesToAssign.length,
        enrollmentType: validEnrollmentType,
      },
    }).catch(() => {});

    return {
      message: `Course "${course.title}" successfully assigned to ${employeesToAssign.length} employee(s).`,
      assignedCount: employeesToAssign.length,
      courseId,
      courseTitle: course.title,
      enrollments: assignedResults,
    };
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
             c.training_link, c.status AS course_status,
             e.first_name, e.last_name, e.employee_code, e.email,
             d.name AS department_name,
             TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS assigned_by_name
      FROM course_enrollments ce
      JOIN courses c ON ce.course_id = c.id
      JOIN employees e ON ce.employee_id = e.id
      LEFT JOIN departments d ON e.dept_id = d.id
      LEFT JOIN users u ON ce.assigned_by = u.id
      WHERE ce.org_id = $1
    `;
    const params = [orgId];

    if (filters.courseId) {
      params.push(filters.courseId);
      sql += ` AND ce.course_id = $${params.length}`;
    }
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

  /**
   * List issued certificates
   * - Training managers see all certificates across organization
   * - Standard staff only see certificates issued to them
   */
  async listCertificates(orgId, filters = {}, isTrainingManager = false, currentEmployeeId = null) {
    let sql = `
      SELECT tc.*, e.email AS employee_email, e.avatar_url AS employee_avatar
      FROM training_certificates tc
      LEFT JOIN employees e ON tc.employee_id = e.id
      WHERE tc.org_id = $1
    `;
    const params = [orgId];

    if (!isTrainingManager) {
      params.push(currentEmployeeId || '__none__');
      sql += ` AND tc.employee_id = $${params.length}`;
    } else if (filters.employeeId) {
      params.push(filters.employeeId);
      sql += ` AND tc.employee_id = $${params.length}`;
    }

    if (filters.search) {
      params.push(`%${filters.search.toLowerCase()}%`);
      sql += ` AND (
        LOWER(tc.employee_name) LIKE $${params.length} 
        OR LOWER(tc.course_title) LIKE $${params.length}
        OR LOWER(COALESCE(tc.employee_code, '')) LIKE $${params.length}
      )`;
    }

    sql += ` ORDER BY tc.issue_date DESC, tc.created_at DESC;`;
    const res = await query(sql, params);
    return res.rows;
  },

  /**
   * Upload and issue a certificate to a particular employee
   */
  async issueCertificate(orgId, currentUser, file, payload) {
    const employeeId = payload.employeeId;
    if (!employeeId) {
      const err = new Error('Please select an employee.');
      err.statusCode = 400;
      throw err;
    }

    const courseTitle = (payload.courseTitle || payload.course_title || payload.title || '').trim();
    if (!courseTitle) {
      const err = new Error('Course or certification title is required.');
      err.statusCode = 400;
      throw err;
    }

    // Lookup employee details
    const empRes = await query(
      `SELECT e.id, e.first_name, e.last_name, e.employee_code, e.email, e.user_id, d.name AS department_name
       FROM employees e
       LEFT JOIN departments d ON e.dept_id = d.id
       WHERE e.id = $1 AND e.org_id = $2;`,
      [employeeId, orgId]
    );

    if (empRes.rows.length === 0) {
      const err = new Error('Employee not found.');
      err.statusCode = 404;
      throw err;
    }

    const emp = empRes.rows[0];
    const employeeName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.email;

    // Handle Certificate File
    let certificateUrl = payload.certificateUrl || payload.certificate_url || '';
    let fileName = payload.fileName || payload.file_name || `${employeeName}_certificate`;
    let fileSize = payload.fileSize || payload.file_size || '';
    let fileType = payload.fileType || payload.file_type || 'application/pdf';

    if (file) {
      fileName = file.originalname || fileName;
      fileType = file.mimetype || fileType;
      const bytes = file.size || (file.buffer ? file.buffer.length : 0);
      fileSize = bytes > 1048576 
        ? `${(bytes / 1048576).toFixed(1)} MB` 
        : `${(bytes / 1024).toFixed(0)} KB`;

      // Try uploading to Cloudinary
      let uploadedToCloud = false;
      try {
        if (file.buffer) {
          const cRes = await cloudinaryService.upload(file.buffer, {
            folder: 'hrms-portal/certificates',
            filename: file.originalname || `${employeeName}_certificate`,
            mimeType: file.mimetype,
          });
          if (cRes?.secureUrl) {
            certificateUrl = cRes.secureUrl;
            uploadedToCloud = true;
          }
        }
      } catch (cloudErr) {
        console.warn('Cloudinary certificate upload notice:', cloudErr.message);
      }

      // If Cloudinary wasn't used or failed, fallback to base64 Data URL
      if (!uploadedToCloud && file.buffer) {
        certificateUrl = `data:${file.mimetype || 'application/pdf'};base64,${file.buffer.toString('base64')}`;
      }
    }

    if (!certificateUrl) {
      const err = new Error('Certificate file is required. Please upload a certificate document or image.');
      err.statusCode = 400;
      throw err;
    }

    const certId = `cert-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const issueDate = payload.issueDate || payload.issue_date || new Date().toISOString().split('T')[0];
    const courseId = payload.courseId || payload.course_id || null;
    const notes = payload.notes || '';
    const issuedByName = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'L&D Team';

    const insertSql = `
      INSERT INTO training_certificates (
        id, org_id, employee_id, employee_name, employee_code, department,
        course_id, course_title, issue_date, certificate_url, file_name, file_size, file_type,
        notes, issued_by_user_id, issued_by_name, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, NOW(), NOW()
      )
      RETURNING *;
    `;

    const res = await query(insertSql, [
      certId,
      orgId,
      employeeId,
      employeeName,
      emp.employee_code || '',
      emp.department_name || '',
      courseId,
      courseTitle,
      issueDate,
      certificateUrl,
      fileName,
      fileSize,
      fileType,
      notes,
      currentUser.id,
      issuedByName,
    ]);

    // If an enrollment exists for this course & employee, mark completed and set certificate_url
    if (courseId) {
      await query(
        `UPDATE course_enrollments
         SET status = 'COMPLETED', progress_percentage = 100, completion_date = $1, certificate_url = $2, updated_at = NOW()
         WHERE course_id = $3 AND employee_id = $4 AND org_id = $5;`,
        [issueDate, certificateUrl, courseId, employeeId, orgId]
      ).catch(() => {});
    }

    // Dispatch in-app notification to the employee
    try {
      if (emp.user_id) {
        await notificationService.createNotification({
          orgId,
          userId: emp.user_id,
          title: `New Certificate Issued: ${courseTitle}`,
          message: `Congratulations! Your certificate for "${courseTitle}" has been issued by the L&D team and is ready for download in your Learning & Development section.`,
          eventType: 'CERTIFICATE_ISSUED',
          entityType: 'CERTIFICATE',
          entityId: certId,
          actionUrl: '/performance/training?tab=certifications',
        });
      }
    } catch (notifErr) {
      console.warn('Failed to send certificate notification:', notifErr.message);
    }

    return res.rows[0];
  },

  /**
   * Delete certificate
   */
  async deleteCertificate(certId, orgId) {
    const existing = await query('SELECT * FROM training_certificates WHERE id = $1 AND org_id = $2;', [certId, orgId]);
    if (existing.rows.length === 0) {
      const err = new Error('Certificate not found.');
      err.statusCode = 404;
      throw err;
    }

    await query('DELETE FROM training_certificates WHERE id = $1 AND org_id = $2;', [certId, orgId]);
    return { success: true, message: 'Certificate deleted successfully.' };
  },
};
