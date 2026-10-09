import { pool } from '../config/db.js';
import { sendError } from '../utils/apiResponse.js';

const normalizeRole = (r) => (r || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Enforces active attendance workday for state mutations (POST, PUT, PATCH, DELETE).
 *
 * Rules:
 * 1. Admin roles (SuperAdmin, Admin, OrgAdmin) are exempt (executive supervision does not track punch attendance).
 * 2. Read-only requests (GET, HEAD, OPTIONS) are exempt.
 * 3. Attendance punch endpoints (/check-in, /check-out, /pause-break, /resume-break) and authentication (/auth/*) are exempt.
 * 4. External webhooks (AppSumo, ATS) are exempt.
 * 5. For HR, Employee, and Manager roles:
 *    - If logged out for the day (record.check_out is set):
 *      -> REJECT with 403 Forbidden: "Access denied: You have logged out for the day. You cannot make any changes or perform operations once your workday is completed."
 *    - If not logged in for the day (!record || !record.check_in):
 *      -> REJECT with 403 Forbidden: "Access denied: You must be logged in for your workday to make changes or perform operations. Please check in first."
 *    - If actively logged in (record.check_in && !record.check_out):
 *      -> ALLOW.
 */
export const enforceActiveWorkday = async (req, res, next) => {
  try {
    // 1. Only enforce on mutation methods
    const method = (req.method || '').toUpperCase();
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return next();
    }

    // 2. Unauthenticated requests are handled by auth middleware
    if (!req.user) {
      return next();
    }

    // 3. Admin roles are strictly exempt
    const normRole = normalizeRole(req.user.roleName);
    if (['admin', 'superadmin', 'orgadmin'].includes(normRole)) {
      return next();
    }

    // 4. Exempt paths that must remain operational without active workday
    const rawPath = (req.originalUrl || req.baseUrl + req.path || req.path || '').toLowerCase();
    const isExempt =
      rawPath.includes('/attendance/check-in') ||
      rawPath.includes('/attendance/check-out') ||
      rawPath.includes('/attendance/pause-break') ||
      rawPath.includes('/attendance/resume-break') ||
      rawPath.includes('/attendance/overtime') ||
      rawPath.includes('/attendance/cron/auto-logout') ||
      rawPath.includes('/v1/auth/') ||
      rawPath.includes('/auth/logout') ||
      rawPath.includes('/auth/login') ||
      rawPath.includes('/auth/refresh') ||
      rawPath.includes('/appsumo/webhook') ||
      rawPath.includes('/integration/ats');

    if (isExempt) {
      return next();
    }

    // 5. Must have employeeId
    const employeeId = req.user.employeeId;
    if (!employeeId) {
      return next();
    }

    // 6. Timezone-aware date string (YYYY-MM-DD)
    const tz = req.user.timezone || 'Asia/Kolkata';
    let todayDate;
    try {
      todayDate = new Date().toLocaleDateString('en-CA', { timeZone: tz });
    } catch {
      todayDate = new Date().toISOString().split('T')[0];
    }

    // Query employee's latest attendance for today or active unclosed record,
    // along with any active in-progress overtime session count in a single query
    const query = `
      SELECT 
        a.id, a.check_in, a.check_out, a.attendance_date,
        (SELECT COUNT(*)::int FROM overtime_records o WHERE o.employee_id = $1 AND o.status = 'IN_PROGRESS') AS active_ot_count
      FROM attendance_records a
      WHERE a.employee_id = $1
        AND (a.attendance_date = $2::date OR a.check_out IS NULL)
      ORDER BY a.attendance_date DESC, a.created_at DESC
      LIMIT 1;
    `;
    const result = await pool.query(query, [employeeId, todayDate]);
    const record = result.rows[0];

    // Case 1: Record exists and has check_out => Check if active in overtime session
    if (record && record.check_out) {
      const activeOtCount = parseInt(record.active_ot_count, 10) || 0;
      if (activeOtCount > 0) {
        // Employee has an active overtime session -> allow work operations
        return next();
      }

      return sendError(
        res,
        'Access denied: You have logged out for the day. You cannot make any changes or perform operations once your workday is completed.',
        403,
        ['Workday completed. Operating changes are disabled after logout.']
      );
    }

    // Case 2: No record or no check_in => Not logged in for the day
    if (!record || !record.check_in) {
      return sendError(
        res,
        'Access denied: You must be logged in for your workday to make changes or perform operations. Please check in first.',
        403,
        ['Active attendance login required to perform changes.']
      );
    }

    // Case 3: Actively logged in (check_in present, check_out null)
    return next();
  } catch (error) {
    console.error('[WorkdayMiddleware] Error checking workday status:', error);
    return next();
  }
};

