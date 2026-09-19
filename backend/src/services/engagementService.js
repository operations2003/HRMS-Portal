import { query } from '../config/db.js';
import { adminService } from './adminService.js';
import { notificationService } from './notificationService.js';

export const engagementService = {
  // ================================================================
  // ANNOUNCEMENTS
  // ================================================================
  async listAnnouncements(orgId, currentUser) {
    const userDeptId = currentUser.deptId || null;
    const userId = currentUser.id;
    const empId = currentUser.employeeId || null;

    const res = await query(
      `SELECT a.*, u.first_name AS author_first, u.last_name AS author_last,
              d.name AS target_dept_name,
              CASE WHEN arr.read_at IS NOT NULL THEN true ELSE false END AS is_read,
              arr.read_at,
              (SELECT COUNT(*) FROM announcement_read_receipts WHERE announcement_id = a.id) AS read_count
       FROM announcements a
       JOIN users u ON a.author_id = u.id
       LEFT JOIN departments d ON a.target_dept_id = d.id
       LEFT JOIN announcement_read_receipts arr ON a.id = arr.announcement_id AND arr.user_id = $2
       WHERE a.org_id = $1 
         AND (a.expiry_date IS NULL OR a.expiry_date >= CURRENT_DATE)
         AND (
           a.target_type = 'ALL'
           OR (a.target_type = 'DEPARTMENT' AND a.target_dept_id = $3)
           OR (a.target_type = 'EMPLOYEE' AND a.target_employee_ids ? $4)
           OR a.author_id = $2
         )
       ORDER BY a.is_pinned DESC, a.publish_date DESC;`,
      [orgId, userId, userDeptId, empId]
    );
    return res.rows;
  },

  async createAnnouncement(orgId, currentUser, payload) {
    const id = `anc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const res = await query(
      `INSERT INTO announcements (
        id, org_id, title, content, category, target_type, target_dept_id,
        target_employee_ids, publish_date, expiry_date, is_pinned, author_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, NOW()), $10, $11, $12, NOW(), NOW())
      RETURNING *;`,
      [
        id,
        orgId,
        payload.title,
        payload.content,
        payload.category || 'GENERAL',
        payload.targetType || 'ALL',
        payload.targetDeptId || null,
        JSON.stringify(payload.targetEmployeeIds || []),
        payload.publishDate || null,
        payload.expiryDate || null,
        payload.isPinned === true || payload.isPinned === 'true',
        currentUser.id,
      ]
    );

    // Audit log
    await adminService.logAction({
      orgId,
      actorUserId: currentUser.id,
      actorRole: currentUser.roleName,
      targetType: 'ANNOUNCEMENT',
      targetId: id,
      action: 'CREATE_ANNOUNCEMENT',
      details: { title: payload.title, category: payload.category },
    }).catch(() => {});

    return res.rows[0];
  },

  async markAsRead(announcementId, currentUser) {
    const id = `arr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    await query(
      `INSERT INTO announcement_read_receipts (id, announcement_id, user_id, read_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (announcement_id, user_id) DO NOTHING;`,
      [id, announcementId, currentUser.id]
    );
    return { success: true };
  },

  // ================================================================
  // SURVEYS & POLLS
  // ================================================================
  async listSurveys(orgId, currentUser) {
    const res = await query(
      `SELECT s.*, u.first_name AS creator_first, u.last_name AS creator_last,
              CASE WHEN sr.id IS NOT NULL THEN true ELSE false END AS has_responded,
              (SELECT COUNT(*) FROM survey_responses WHERE survey_id = s.id) AS total_responses
       FROM engagement_surveys s
       JOIN users u ON s.created_by = u.id
       LEFT JOIN survey_responses sr ON s.id = sr.survey_id AND sr.respondent_id = $2
       WHERE s.org_id = $1 AND s.status = 'ACTIVE'
       ORDER BY s.created_at DESC;`,
      [orgId, currentUser.id]
    );
    return res.rows;
  },

  async createSurvey(orgId, currentUser, payload) {
    const id = `srv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const res = await query(
      `INSERT INTO engagement_surveys (
        id, org_id, title, description, questions, target_type, target_dept_id,
        start_date, end_date, is_anonymous, status, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, CURRENT_DATE), $9, $10, 'ACTIVE', $11, NOW())
      RETURNING *;`,
      [
        id,
        orgId,
        payload.title,
        payload.description || '',
        JSON.stringify(payload.questions || []),
        payload.targetType || 'ALL',
        payload.targetDeptId || null,
        payload.startDate || null,
        payload.endDate || null,
        payload.isAnonymous !== false,
        currentUser.id,
      ]
    );
    return res.rows[0];
  },

  async submitSurveyResponse(surveyId, currentUser, payload) {
    const id = `srsp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const res = await query(
      `INSERT INTO survey_responses (id, survey_id, respondent_id, answers, submitted_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (survey_id, respondent_id) DO UPDATE
       SET answers = EXCLUDED.answers, submitted_at = NOW()
       RETURNING *;`,
      [id, surveyId, currentUser.id, JSON.stringify(payload.answers || {})]
    );
    return res.rows[0];
  },

  // ================================================================
  // PEER RECOGNITION (KUDOS)
  // ================================================================
  async listRecognitions(orgId) {
    const res = await query(
      `SELECT r.*, s.first_name AS sender_first, s.last_name AS sender_last,
              rc.first_name AS recipient_first, rc.last_name AS recipient_last,
              d.name AS recipient_department
       FROM employee_recognitions r
       JOIN employees s ON r.sender_id = s.id
       JOIN employees rc ON r.recipient_id = rc.id
       LEFT JOIN departments d ON rc.dept_id = d.id
       WHERE r.org_id = $1
       ORDER BY r.created_at DESC
       LIMIT 50;`,
      [orgId]
    );
    return res.rows;
  },

  async giveRecognition(orgId, currentUser, payload) {
    const senderId = currentUser.employeeId;
    if (!senderId) {
      const err = new Error('You must have an employee profile to give recognition.');
      err.statusCode = 400;
      throw err;
    }

    if (senderId === payload.recipientId) {
      const err = new Error('Self-recognition is not permitted.');
      err.statusCode = 400;
      throw err;
    }

    const id = `recog-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const res = await query(
      `INSERT INTO employee_recognitions (id, org_id, sender_id, recipient_id, badge_type, message, is_public, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
       RETURNING *;`,
      [id, orgId, senderId, payload.recipientId, payload.badgeType || 'KUDOS', payload.message]
    );

    // Notify recipient
    const recipientRes = await query('SELECT user_id FROM employees WHERE id = $1;', [payload.recipientId]);
    if (recipientRes.rows[0]?.user_id) {
      await notificationService.createNotification({
        orgId,
        userId: recipientRes.rows[0].user_id,
        eventType: 'KUDOS_RECEIVED',
        title: '🎉 You received Kudos!',
        message: `${currentUser.firstName || 'A colleague'} sent you recognition: "${payload.message}".`,
        entityType: 'RECOGNITION',
        entityId: id,
      }).catch(() => {});
    }

    return res.rows[0];
  },
};

