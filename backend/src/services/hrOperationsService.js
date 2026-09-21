import { pool } from '../config/db.js';
import { exitRepository } from '../repositories/exitRepository.js';
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

      // 7. Active exits & offboarding
      pool.query(
        `SELECT 
          COUNT(*) FILTER (WHERE status IN ('SUBMITTED', 'UNDER_REVIEW'))::int AS "pendingExits",
          COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS "noticePeriodExits"
        FROM exit_requests
        WHERE org_id = $1;`,
        [orgId]
      ),
    ]);

    const empStats = empStatsRes.rows[0] || { totalEmployees: 0, activeEmployees: 0, onLeaveCount: 0 };
    const pendingLeaves = pendingLeavesRes.rows[0]?.pendingLeaves || 0;
    const pendingRequests = pendingRequestsRes.rows[0]?.pendingRequests || 0;
    const openTickets = openTicketsRes.rows[0]?.openTickets || 0;
    const pendingAppraisals = pendingAppraisalsRes.rows[0]?.pendingAppraisals || 0;
    const activeOnboardings = onboardingRes.rows[0]?.activeOnboardings || 0;
    const exitStats = (arguments.length > 0 && arguments[0]) || {};
    const pendingExits = empStatsRes && empStatsRes.length ? 0 : 0; // fallback safety
    const exitRow = (await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE status IN ('SUBMITTED', 'UNDER_REVIEW'))::int AS "pendingExits",
        COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS "noticePeriodExits"
      FROM exit_requests WHERE org_id = $1;`,
      [orgId]
    )).rows[0] || { pendingExits: 0, noticePeriodExits: 0 };

    return {
      workforce: {
        totalEmployees: empStats.totalEmployees,
        activeEmployees: empStats.activeEmployees,
        onLeaveToday: empStats.onLeaveCount,
        noticePeriodCount: exitRow.noticePeriodExits,
      },
      actionItems: {
        pendingLeaves,
        pendingRequests,
        openTickets,
        pendingAppraisals,
        activeOnboardings,
        pendingExits: exitRow.pendingExits,
        noticePeriodExits: exitRow.noticePeriodExits,
        totalPendingActions: pendingLeaves + pendingRequests + openTickets + pendingAppraisals + exitRow.pendingExits,
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
          d.name AS "department_name",
          lr.start_date, lr.end_date, lr.total_days AS "days_count", lr.status, lr.created_at
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        LEFT JOIN departments d ON e.dept_id = d.id
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
          d.name AS "department_name",
          er.priority, er.status, er.created_at
        FROM employee_requests er
        JOIN employees e ON er.employee_id = e.id
        LEFT JOIN departments d ON e.dept_id = d.id
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
          d.name AS "department_name",
          pr.current_stage AS "stage", pr.status, pr.created_at
        FROM performance_records pr
        JOIN employees e ON pr.employee_id = e.id
        LEFT JOIN departments d ON e.dept_id = d.id
        WHERE pr.org_id = $1 AND pr.current_stage = 'HR_REVIEW'
        ORDER BY pr.created_at DESC
        LIMIT 25;`,
        [orgId]
      ),
    ]);

    const items = [
      ...leavesRes.rows.map((r) => {
        const empName = `${r.first_name || ''} ${r.last_name || ''}`.trim() || 'Employee';
        const dept = r.department_name || 'General';
        return {
          id: r.id,
          module: 'LEAVE',
          moduleLabel: 'Leave Application',
          title: `${r.title} (${r.days_count} days)`,
          employeeName: empName,
          requester: empName,
          employeeCode: r.employee_code,
          departmentName: dept,
          employee: {
            id: r.employeeId,
            fullName: empName,
            firstName: r.first_name,
            lastName: r.last_name,
            employeeCode: r.employee_code,
            departmentName: dept,
            department: { name: dept },
          },
          status: r.status,
          date: r.created_at,
          actionUrl: `/leaves`,
        };
      }),
      ...requestsRes.rows.map((r) => {
        const empName = `${r.first_name || ''} ${r.last_name || ''}`.trim() || 'Employee';
        const dept = r.department_name || 'General';
        return {
          id: r.id,
          module: 'REQUEST',
          moduleLabel: 'Service Request',
          title: r.title,
          employeeName: empName,
          requester: empName,
          employeeCode: r.employee_code,
          departmentName: dept,
          employee: {
            id: r.employeeId,
            fullName: empName,
            firstName: r.first_name,
            lastName: r.last_name,
            employeeCode: r.employee_code,
            departmentName: dept,
            department: { name: dept },
          },
          status: r.status,
          date: r.created_at,
          actionUrl: `/requests`,
        };
      }),
      ...perfRes.rows.map((r) => {
        const empName = `${r.first_name || ''} ${r.last_name || ''}`.trim() || 'Employee';
        const dept = r.department_name || 'General';
        return {
          id: r.id,
          module: 'PERFORMANCE',
          moduleLabel: 'Performance Appraisal',
          title: `Appraisal Cycle: ${r.title}`,
          employeeName: empName,
          requester: empName,
          employeeCode: r.employee_code,
          departmentName: dept,
          employee: {
            id: r.employeeId,
            fullName: empName,
            firstName: r.first_name,
            lastName: r.last_name,
            employeeCode: r.employee_code,
            departmentName: dept,
            department: { name: dept },
          },
          status: r.status,
          date: r.created_at,
          actionUrl: `/performance/${r.id}`,
        };
      }),
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

  /**
   * Employee Operational Dossier (Comprehensive 360 profile for HR)
   */
  async getEmployeeOperationalProfile(currentUser, employeeId) {
    this.assertHrAdmin(currentUser);
    const orgId = currentUser.orgId;

    if (!employeeId || typeof employeeId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(employeeId)) {
      const err = new Error('Invalid employee ID format.');
      err.statusCode = 400;
      throw err;
    }

    // 1. Fetch employee core details
    const empRes = await pool.query(
      `SELECT 
        e.id, e.employee_code, e.first_name, e.last_name, e.email, e.phone,
        e.date_of_joining, e.employment_type, e.status, e.manager_id, e.org_id,
        d.id AS dept_id, d.name AS dept_name,
        ds.id AS desig_id, ds.title AS desig_title,
        m.first_name AS mgr_first_name, m.last_name AS mgr_last_name, m.employee_code AS mgr_code
      FROM employees e
      LEFT JOIN departments d ON e.dept_id = d.id
      LEFT JOIN designations ds ON e.desig_id = ds.id
      LEFT JOIN employees m ON e.manager_id = m.id
      WHERE e.id = $1;`,
      [employeeId]
    );

    if (empRes.rows.length === 0) {
      const err = new Error('Employee not found.');
      err.statusCode = 404;
      throw err;
    }

    const emp = empRes.rows[0];

    // Verify organization scope
    if (emp.org_id !== orgId) {
      const err = new Error('Access denied: Employee belongs to a different organization.');
      err.statusCode = 403;
      throw err;
    }

    // 2. Parallel fetch operational metrics
    const [leaveRes, attRes, perfRes, reqRes, docRes] = await Promise.all([
      // Leave balance and recent leaves
      pool.query(
        `SELECT 
          lt.name AS leave_type,
          lb.allocated_days,
          lb.used_days,
          (lb.allocated_days - lb.used_days) AS remaining_days
        FROM leave_balances lb
        JOIN leave_types lt ON lb.leave_type_id = lt.id
        WHERE lb.employee_id = $1;`,
        [employeeId]
      ),

      // 30 days attendance rate
      pool.query(
        `SELECT 
          COUNT(*)::int AS total_days,
          COUNT(*) FILTER (WHERE LOWER(status) IN ('present', 'late', 'half-day'))::int AS present_days,
          COUNT(*) FILTER (WHERE LOWER(status) = 'late')::int AS late_days,
          COUNT(*) FILTER (WHERE LOWER(status) = 'absent')::int AS absent_days
        FROM attendance_records
        WHERE employee_id = $1
          AND attendance_date >= CURRENT_DATE - INTERVAL '30 days';`,
        [employeeId]
      ),

      // Latest performance appraisal
      pool.query(
        `SELECT id, review_period, status, current_stage, rating, score, updated_at
        FROM performance_records
        WHERE employee_id = $1
        ORDER BY created_at DESC
        LIMIT 1;`,
        [employeeId]
      ),

      // Open requests count
      pool.query(
        `SELECT COUNT(*)::int AS open_requests
        FROM employee_requests
        WHERE employee_id = $1 AND status IN ('PENDING', 'IN_PROGRESS');`,
        [employeeId]
      ),

      // Uploaded documents count
      pool.query(
        `SELECT COUNT(*)::int AS doc_count
        FROM document_vault
        WHERE owner_id = $1;`,
        [employeeId]
      ),
    ]);

    const att = attRes.rows[0] || { total_days: 0, present_days: 0, late_days: 0, absent_days: 0 };
    const attendanceRate = att.total_days > 0 ? Math.round((att.present_days / att.total_days) * 100) : 100;

    return {
      employee: {
        id: emp.id,
        employeeCode: emp.employee_code,
        fullName: `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
        email: emp.email,
        phone: emp.phone,
        dateOfJoining: emp.date_of_joining,
        employmentType: emp.employment_type,
        status: emp.status,
        department: emp.dept_name ? { id: emp.dept_id, name: emp.dept_name } : null,
        designation: emp.desig_title ? { id: emp.desig_id, title: emp.desig_title } : null,
        reportingManager: emp.manager_id
          ? {
              id: emp.manager_id,
              name: `${emp.mgr_first_name || ''} ${emp.mgr_last_name || ''}`.trim(),
              code: emp.mgr_code,
            }
          : null,
      },
      operationalMetrics: {
        attendance: {
          last30DaysRate: `${attendanceRate}%`,
          totalLoggedDays: att.total_days,
          presentDays: att.present_days,
          lateDays: att.late_days,
          absentDays: att.absent_days,
        },
        leaves: {
          balances: leaveRes.rows,
        },
        performance: perfRes.rows[0] || null,
        openServiceRequests: reqRes.rows[0]?.open_requests || 0,
        documentsCount: docRes.rows[0]?.doc_count || 0,
      },
    };
  },

  /**
   * Teams & Managers Overview for HR
   */
  async getTeamsOverview(currentUser) {
    this.assertHrAdmin(currentUser);
    const orgId = currentUser.orgId;

    const { rows } = await pool.query(
      `SELECT 
        m.id AS "managerId",
        m.employee_code AS "managerCode",
        m.first_name AS "managerFirstName",
        m.last_name AS "managerLastName",
        d.name AS "departmentName",
        COUNT(e.id)::int AS "teamSize",
        COUNT(e.id) FILTER (WHERE LOWER(e.status) = 'active')::int AS "activeMembers"
      FROM employees m
      JOIN employees e ON e.manager_id = m.id
      LEFT JOIN departments d ON m.dept_id = d.id
      WHERE m.org_id = $1
      GROUP BY m.id, m.employee_code, m.first_name, m.last_name, d.name
      ORDER BY "teamSize" DESC;`,
      [orgId]
    );

    return rows.map((r) => ({
      managerId: r.managerId,
      managerCode: r.managerCode,
      managerName: `${r.managerFirstName || ''} ${r.managerLastName || ''}`.trim(),
      department: r.departmentName || 'General',
      teamSize: r.teamSize,
      activeMembers: r.activeMembers,
    }));
  },

  /**
   * Team Roster by Manager ID for HR
   */
  async getTeamByManager(currentUser, managerId) {
    this.assertHrAdmin(currentUser);
    const orgId = currentUser.orgId;

    if (!managerId || typeof managerId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(managerId)) {
      const err = new Error('Invalid manager ID format.');
      err.statusCode = 400;
      throw err;
    }

    const mgrRes = await pool.query(
      `SELECT id, first_name, last_name, employee_code, org_id FROM employees WHERE id = $1;`,
      [managerId]
    );

    if (mgrRes.rows.length === 0) {
      const err = new Error('Manager not found.');
      err.statusCode = 404;
      throw err;
    }

    if (mgrRes.rows[0].org_id !== orgId) {
      const err = new Error('Access denied: Manager belongs to a different organization.');
      err.statusCode = 403;
      throw err;
    }

    const { rows } = await pool.query(
      `SELECT 
        e.id, e.employee_code, e.first_name, e.last_name, e.email, e.status,
        d.name AS department_name, ds.title AS designation_title
      FROM employees e
      LEFT JOIN departments d ON e.dept_id = d.id
      LEFT JOIN designations ds ON e.desig_id = ds.id
      WHERE e.manager_id = $1 AND e.org_id = $2
      ORDER BY e.first_name ASC;`,
      [managerId, orgId]
    );

    const mgr = mgrRes.rows[0];
    return {
      manager: {
        id: mgr.id,
        name: `${mgr.first_name || ''} ${mgr.last_name || ''}`.trim(),
        employeeCode: mgr.employee_code,
      },
      teamMembers: rows.map((r) => ({
        id: r.id,
        employeeCode: r.employee_code,
        name: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
        email: r.email,
        status: r.status,
        department: r.department_name,
        designation: r.designation_title,
      })),
      totalMembers: rows.length,
    };
  },

  /**
   * Organization-wide Performance Summary for HR
   */
  async getPerformanceSummary(currentUser) {
    this.assertHrAdmin(currentUser);
    const orgId = currentUser.orgId;

    const [statsRes, periodRes] = await Promise.all([
      pool.query(
        `SELECT 
          COUNT(*)::int AS "totalAppraisals",
          COUNT(*) FILTER (WHERE status = 'DRAFT')::int AS "draftCount",
          COUNT(*) FILTER (WHERE status = 'SUBMITTED')::int AS "submittedCount",
          COUNT(*) FILTER (WHERE status = 'UNDER_REVIEW')::int AS "underReviewCount",
          COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS "approvedCount",
          COUNT(*) FILTER (WHERE status = 'RETURNED')::int AS "returnedCount",
          COUNT(*) FILTER (WHERE status = 'REJECTED')::int AS "rejectedCount",
          ROUND(AVG(rating) FILTER (WHERE status = 'APPROVED')::numeric, 2) AS "averageRating"
        FROM performance_records
        WHERE org_id = $1;`,
        [orgId]
      ),
      pool.query(
        `SELECT id, name, status, start_date, end_date, due_date
        FROM performance_periods
        WHERE org_id = $1
        ORDER BY created_at DESC
        LIMIT 5;`,
        [orgId]
      ),
    ]);

    const s = statsRes.rows[0] || {};
    const total = s.totalAppraisals || 0;
    const completed = s.approvedCount || 0;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      totalAppraisals: total,
      completedAppraisals: completed,
      completionRate: `${completionRate}%`,
      averageRating: s.averageRating ? parseFloat(s.averageRating) : null,
      statusBreakdown: {
        draft: s.draftCount || 0,
        submitted: s.submittedCount || 0,
        underReview: s.underReviewCount || 0,
        approved: s.approvedCount || 0,
        returned: s.returnedCount || 0,
        rejected: s.rejectedCount || 0,
      },
      recentCycles: periodRes.rows,
    };
  },

  /**
   * Organization-wide Attendance Summary for HR
   */
  async getAttendanceSummary(currentUser) {
    this.assertHrAdmin(currentUser);
    const orgId = currentUser.orgId;
    const todayStr = new Date().toISOString().split('T')[0];

    const { rows } = await pool.query(
      `SELECT 
        (SELECT COUNT(*)::int FROM employees WHERE org_id = $1 AND LOWER(status) = 'active') AS "totalActiveEmployees",
        COUNT(a.id)::int AS "totalMarkedToday",
        COUNT(a.id) FILTER (WHERE LOWER(a.status) = 'present')::int AS "presentToday",
        COUNT(a.id) FILTER (WHERE LOWER(a.status) = 'late')::int AS "lateToday",
        COUNT(a.id) FILTER (WHERE LOWER(a.status) = 'half-day')::int AS "halfDayToday",
        COUNT(a.id) FILTER (WHERE LOWER(a.status) = 'absent')::int AS "absentToday"
      FROM attendance_records a
      JOIN employees e ON a.employee_id = e.id
      WHERE e.org_id = $1 AND a.attendance_date = $2;`,
      [orgId, todayStr]
    );

    const data = rows[0] || {};
    const totalActive = data.totalActiveEmployees || 0;
    const present = (data.presentToday || 0) + (data.lateToday || 0) + (data.halfDayToday || 0);
    const attendanceRate = totalActive > 0 ? Math.round((present / totalActive) * 100) : 0;

    return {
      date: todayStr,
      totalActiveEmployees: totalActive,
      present: data.presentToday || 0,
      late: data.lateToday || 0,
      halfDay: data.halfDayToday || 0,
      absent: data.absentToday || 0,
      attendanceRate: `${attendanceRate}%`,
    };
  },

  /**
   * Organization-wide Leave Summary for HR
   */
  async getLeaveSummary(currentUser) {
    this.assertHrAdmin(currentUser);
    const orgId = currentUser.orgId;

    const [statsRes, byTypeRes] = await Promise.all([
      pool.query(
        `SELECT 
          COUNT(*)::int AS "totalLeavesLogged",
          COUNT(*) FILTER (WHERE lr.status = 'PENDING')::int AS "pendingCount",
          COUNT(*) FILTER (WHERE lr.status = 'APPROVED')::int AS "approvedCount",
          COUNT(*) FILTER (WHERE lr.status = 'REJECTED')::int AS "rejectedCount"
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        WHERE e.org_id = $1;`,
        [orgId]
      ),
      pool.query(
        `SELECT 
          lt.name AS "leaveType",
          COUNT(lr.id)::int AS "requestCount",
          COALESCE(SUM(lr.total_days), 0)::numeric AS "totalDays"
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        JOIN leave_types lt ON lr.leave_type_id = lt.id
        WHERE e.org_id = $1
        GROUP BY lt.name
        ORDER BY "requestCount" DESC;`,
        [orgId]
      ),
    ]);

    const stats = statsRes.rows[0] || {};
    return {
      pendingApprovals: stats.pendingCount || 0,
      approvedTotal: stats.approvedCount || 0,
      rejectedTotal: stats.rejectedCount || 0,
      totalRequests: stats.totalLeavesLogged || 0,
      leavesByType: byTypeRes.rows,
    };
  },

  /**
   * Organization Exit & Offboarding Analytics Summary
   */
  async getExitSummary(currentUser) {
    this.assertHrAdmin(currentUser);
    return exitRepository.getExitStats(currentUser.orgId);
  },
};

export default hrOperationsService;
