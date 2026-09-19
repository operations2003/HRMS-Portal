import { query } from '../config/db.js';

export const analyticsService = {
  /**
   * Comprehensive HR Analytics & Workforce Intelligence
   * Strict Rule: Reconciles authoritatively from primary tables; zero payroll calculations.
   */
  async getWorkforceAnalytics(orgId) {
    // 1. Headcount & Employee Status Distribution
    const empStatsRes = await query(
      `SELECT 
         COUNT(*) AS total_headcount,
         COUNT(*) FILTER (WHERE status = 'Active') AS active_employees,
         COUNT(*) FILTER (WHERE status = 'Probation' OR probation_status = 'IN_PROBATION') AS in_probation,
         COUNT(*) FILTER (WHERE status = 'Onboarding') AS onboarding,
         COUNT(*) FILTER (WHERE status = 'Exited' OR status = 'Terminated') AS exited_employees,
         COUNT(*) FILTER (WHERE date_of_joining >= date_trunc('month', CURRENT_DATE)) AS joined_this_month
       FROM employees
       WHERE org_id = $1;`,
      [orgId]
    );
    const empStats = empStatsRes.rows[0];

    // 2. Department Breakdown
    const deptStatsRes = await query(
      `SELECT d.id, d.name, COUNT(e.id) AS employee_count
       FROM departments d
       LEFT JOIN employees e ON d.id = e.dept_id AND e.status = 'Active' AND e.org_id = d.org_id
       WHERE d.org_id = $1
       GROUP BY d.id, d.name
       ORDER BY employee_count DESC;`,
      [orgId]
    );

     // 3. Attendance Rate Today
    const today = new Date().toISOString().split('T')[0];
    const attStatsRes = await query(
      `SELECT 
         COUNT(*) FILTER (WHERE status = 'PRESENT') AS present_today,
         COUNT(*) FILTER (WHERE status = 'LATE') AS late_today,
         COUNT(*) FILTER (WHERE status = 'HALF_DAY') AS half_day_today,
         COUNT(*) FILTER (WHERE status = 'ABSENT') AS absent_today
       FROM attendance_records
       WHERE org_id = $1 AND attendance_date = $2;`,
      [orgId, today]
    );
    const attStats = attStatsRes.rows[0];
    const totalActive = parseInt(empStats.active_employees, 10) || 1;
    const presentCount = parseInt(attStats.present_today || 0, 10) + parseInt(attStats.late_today || 0, 10);
    const attendancePercentage = Math.round((presentCount / totalActive) * 100);

    // 4. Leave Utilization
    const leaveStatsRes = await query(
      `SELECT lt.name AS leave_type, 
              COALESCE(SUM(lr.total_days), 0) AS total_days_taken,
              COUNT(lr.id) AS approved_requests_count
       FROM leave_types lt
       LEFT JOIN leave_requests lr ON lt.id = lr.leave_type_id AND lr.status = 'APPROVED'
       WHERE lt.org_id = $1
       GROUP BY lt.id, lt.name
       ORDER BY total_days_taken DESC;`,
      [orgId]
    );

    // 5. Training & Skill Development Metrics
    const trainingStatsRes = await query(
      `SELECT 
         (SELECT COUNT(*) FROM courses WHERE org_id = $1 AND status = 'ACTIVE') AS active_courses,
         COUNT(ce.id) AS total_enrollments,
         COUNT(ce.id) FILTER (WHERE ce.status = 'COMPLETED') AS completed_enrollments,
         ROUND(AVG(ce.progress_percentage), 1) AS average_progress
       FROM course_enrollments ce
       WHERE ce.org_id = $1;`,
      [orgId]
    );
    const trainingStats = trainingStatsRes.rows[0];

    // 6. Helpdesk & Support Resolution
    const ticketStatsRes = await query(
      `SELECT 
         COUNT(*) AS total_tickets,
         COUNT(*) FILTER (WHERE status = 'OPEN') AS open_tickets,
         COUNT(*) FILTER (WHERE status = 'RESOLVED' OR status = 'CLOSED') AS resolved_tickets,
         COUNT(*) FILTER (WHERE priority = 'URGENT') AS urgent_tickets
       FROM helpdesk_tickets
       WHERE org_id = $1;`,
      [orgId]
    );
    const ticketStats = ticketStatsRes.rows[0];

    // 7. Attrition Rate calculation
    const totalExitCount = parseInt(empStats.exited_employees, 10) || 0;
    const attritionRate = totalActive > 0 ? ((totalExitCount / (totalActive + totalExitCount)) * 100).toFixed(1) : '0.0';

    const workforceMetrics = {
      totalHeadcount: parseInt(empStats.total_headcount, 10),
      activeEmployees: parseInt(empStats.active_employees, 10),
      inProbation: parseInt(empStats.in_probation, 10),
      onboarding: parseInt(empStats.onboarding, 10),
      exitedEmployees: totalExitCount,
      joinedThisMonth: parseInt(empStats.joined_this_month, 10),
      attritionRatePercentage: parseFloat(attritionRate),
    };

    return {
      workforce: workforceMetrics,
      headcount: workforceMetrics,
      turnover: {
        retentionRate: (100 - parseFloat(attritionRate)).toFixed(1),
        attritionRate: parseFloat(attritionRate),
      },
      departments: deptStatsRes.rows,
      attendance: {
        date: today,
        presentToday: parseInt(attStats.present_today || 0, 10),
        lateToday: parseInt(attStats.late_today || 0, 10),
        absentToday: parseInt(attStats.absent_today || 0, 10),
        attendanceRate: attendancePercentage,
      },
      leaveUtilization: leaveStatsRes.rows,
      trainingMetrics: {
        activeCourses: parseInt(trainingStats?.active_courses || 0, 10),
        totalEnrollments: parseInt(trainingStats?.total_enrollments || 0, 10),
        completedEnrollments: parseInt(trainingStats?.completed_enrollments || 0, 10),
        averageProgress: parseFloat(trainingStats?.average_progress || 0.0),
      },
      helpdeskMetrics: {
        totalTickets: parseInt(ticketStats.total_tickets, 10),
        openTickets: parseInt(ticketStats.open_tickets, 10),
        resolvedTickets: parseInt(ticketStats.resolved_tickets, 10),
        urgentTickets: parseInt(ticketStats.urgent_tickets, 10),
      },
    };
  },
};
