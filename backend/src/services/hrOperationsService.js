import { pool } from '../config/db.js';
import { notificationService } from './notificationService.js';
import { logger } from '../utils/logger.js';

export const hrOperationsService = {
  /**
   * Helper to verify HR or Admin role
   */
  assertHrAdmin(currentUser) {
    const role = (currentUser.roleName || '').toLowerCase();
    if (!['admin', 'superadmin', 'hr', 'hrmanager'].includes(role)) {
      const err = new Error('Forbidden: Only HR Personnel or System Administrators can access HR Operations.');
      err.statusCode = 403;
      throw err;
    }
  },

  /**
   * Consolidated HR Operations Cockpit Overview
   */
  async getOperationsOverview(currentUser) {
    this.assertHrAdmin(currentUser);
    const orgId = currentUser.orgId;
    const todayStr = new Date().toISOString().split('T')[0];

    const [
      empStatsRes,
      pendingLeavesRes,
      pendingRequestsRes,
      openTicketsRes,
      pendingAppraisalsRes,
      onboardingRes,
    ] = await Promise.all([
      // 1. Employee headcount & attendance overview
      pool.query(
        `SELECT 
          COUNT(*)::int AS "totalEmployees",
          COUNT(*) FILTER (WHERE LOWER(status) = 'active')::int AS "activeEmployees",
          COUNT(*) FILTER (WHERE LOWER(status) = 'on leave')::int AS "onLeaveCount"
        FROM employees
        WHERE org_id = $1;`,
        [orgId]
      ),

      // 2. Pending leaves
      pool.query(
        `SELECT COUNT(*)::int AS "pendingLeaves"
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        WHERE e.org_id = $1 AND lr.status = 'PENDING';`,
        [orgId]
      ),

      // 3. Pending employee service requests
      pool.query(
        `SELECT COUNT(*)::int AS "pendingRequests"
        FROM employee_requests
        WHERE org_id = $1 AND status IN ('PENDING', 'IN_PROGRESS');`,
        [orgId]
      ),

      // 4. Open helpdesk tickets
      pool.query(
        `SELECT COUNT(*)::int AS "openTickets"
        FROM helpdesk_tickets
        WHERE org_id = $1 AND status IN ('OPEN', 'IN_PROGRESS');`,
        [orgId]
      ),

      // 5. Pending performance appraisals
      pool.query(
        `SELECT COUNT(*)::int AS "pendingAppraisals"
        FROM performance_records
        WHERE org_id = $1 AND status IN ('SUBMITTED', 'UNDER_REVIEW');`,
        [orgId]
      ),

      // 6. Onboarding candidates in pipeline
      pool.query(
        `SELECT COUNT(*)::int AS "activeOnboardings"
        FROM new_hires
        WHERE org_id = $1 AND onboarding_status NOT IN ('COMPLETED', 'CANCELLED');`,
        [orgId]
      ),
    ]);

    const empStats = empStatsRes.rows[0] || { totalEmployees: 0, activeEmployees: 0, onLeaveCount: 0 };
    const pendingLeaves = pendingLeavesRes.rows[0]?.pendingLeaves || 0;
    const pendingRequests = pendingRequestsRes.rows[0]?.pendingRequests || 0;
    const openTickets = openTicketsRes.rows[0]?.openTickets || 0;
    const pendingAppraisals = pendingAppraisalsRes.rows[0]?.pendingAppraisals || 0;
    const activeOnboardings = onboardingRes.rows[0]?.activeOnboardings || 0;

    return {
      workforce: {
        totalEmployees: empStats.totalEmployees,
        activeEmployees: empStats.activeEmployees,
        onLeaveToday: empStats.onLeaveCount,
      },
      actionItems: {
        pendingLeaves,
        pendingRequests,
        openTickets,
        pendingAppraisals,
        activeOnboardings,
        totalPendingActions: pendingLeaves + pendingRequests + openTickets + pendingAppraisals,
      },
      lastUpdated: new Date().toISOString(),
    };
  },

  /**
   * Unified Cross-Module Approval Queue
   */
  async getUnifiedApprovalQueue(currentUser) {
    this.assertHrAdmin(currentUser);
    const orgId = currentUser.orgId;

    const [leavesRes, requestsRes, perfRes] = await Promise.all([
      // Pending Leaves
      pool.query(
        `SELECT 
          lr.id, 'LEAVE' AS "module", 'Leave Request' AS "type",
          lt.name AS "title",
          e.id AS "employeeId", e.first_name, e.last_name, e.employee_code,
          lr.start_date, lr.end_date, lr.total_days AS "days_count", lr.status, lr.created_at
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        JOIN leave_types lt ON lr.leave_type_id = lt.id
        WHERE e.org_id = $1 AND lr.status = 'PENDING'
        ORDER BY lr.created_at DESC
        LIMIT 25;`,
        [orgId]
      ),

      // Pending Employee Requests
      pool.query(
        `SELECT 
          er.id, 'REQUEST' AS "module", er.request_type AS "type",
          er.subject AS "title",
          e.id AS "employeeId", e.first_name, e.last_name, e.employee_code,
          er.priority, er.status, er.created_at
        FROM employee_requests er
        JOIN employees e ON er.employee_id = e.id
        WHERE er.org_id = $1 AND er.status IN ('PENDING', 'IN_PROGRESS')
        ORDER BY er.created_at DESC
        LIMIT 25;`,
        [orgId]
      ),

      // Pending Performance Appraisals at HR stage
      pool.query(
        `SELECT 
          pr.id, 'PERFORMANCE' AS "module", 'Appraisal' AS "type",
          pr.review_period AS "title",
          e.id AS "employeeId", e.first_name, e.last_name, e.employee_code,
          pr.current_stage AS "stage", pr.status, pr.created_at
        FROM performance_records pr
        JOIN employees e ON pr.employee_id = e.id
        WHERE pr.org_id = $1 AND pr.current_stage = 'HR_REVIEW'
        ORDER BY pr.created_at DESC
        LIMIT 25;`,
        [orgId]
      ),
    ]);

    const items = [
      ...leavesRes.rows.map((r) => ({
        id: r.id,
        module: 'LEAVE',
        moduleLabel: 'Leave Application',
        title: `${r.title} (${r.days_count} days)`,
        requester: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
        employeeCode: r.employee_code,
        status: r.status,
        date: r.created_at,
        actionUrl: `/leaves`,
      })),
      ...requestsRes.rows.map((r) => ({
        id: r.id,
        module: 'REQUEST',
        moduleLabel: 'Service Request',
        title: r.title,
        requester: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
        employeeCode: r.employee_code,
        status: r.status,
        date: r.created_at,
        actionUrl: `/requests`,
      })),
      ...perfRes.rows.map((r) => ({
        id: r.id,
        module: 'PERFORMANCE',
        moduleLabel: 'Performance Appraisal',
        title: `Appraisal Cycle: ${r.title}`,
        requester: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
        employeeCode: r.employee_code,
        status: r.status,
        date: r.created_at,
        actionUrl: `/performance/${r.id}`,
      })),
    ];

    // Sort combined feed by date descending
    items.sort((a, b) => new Date(b.date) - new Date(a.date));

    return items;
  },

  /**
   * Broadcast Operational Announcement to workforce
   */
  async broadcastAnnouncement(currentUser, { title, message, targetRole = null }) {
    this.assertHrAdmin(currentUser);
    const orgId = currentUser.orgId;

    if (!title || !message) {
      const err = new Error('Announcement title and message are required.');
      err.statusCode = 400;
      throw err;
    }

    // Fetch all target user IDs in this organization
    let userQuery = `SELECT id FROM users WHERE org_id = $1 AND status = 'Active'`;
    const params = [orgId];

    if (targetRole) {
      userQuery += ` AND role_id = (SELECT id FROM roles WHERE LOWER(name) = LOWER($2))`;
      params.push(targetRole);
    }

    const { rows } = await pool.query(userQuery, params);
    const userIds = rows.map((r) => r.id);

    if (userIds.length === 0) {
      return { recipientCount: 0 };
    }

    const notifications = userIds.map((userId) => ({
      orgId,
      userId,
      eventType: 'GENERAL_ALERT',
      title: `HR Announcement: ${title}`,
      message,
      entityType: 'HR_OPERATIONS',
      entityId: 'announcement',
      actionUrl: '/dashboard',
    }));

    await notificationService.createSystemNotification({
      orgId,
      userId: currentUser.id,
      eventType: 'GENERAL_ALERT',
      title: `HR Announcement Broadcast: ${title}`,
      message: `Announcement sent to ${userIds.length} members.`,
      entityType: 'HR_OPERATIONS',
      entityId: 'broadcast',
      actionUrl: '/dashboard',
    });

    // Batch insert notifications
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const n of notifications) {
        await client.query(
          `INSERT INTO notifications (
            id, org_id, user_id, event_type, title, message, entity_type, entity_id, action_url
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            `notif-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            n.orgId,
            n.userId,
            n.eventType,
            n.title,
            n.message,
            n.entityType,
            n.entityId,
            n.actionUrl,
          ]
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    logger.info('HrOperationsService', `Broadcasted announcement '${title}' to ${userIds.length} users`);
    return { recipientCount: userIds.length, title };
  },
};

export default hrOperationsService;
