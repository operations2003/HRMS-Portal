import { attendanceRepository } from '../repositories/attendanceRepository.js';
import { employeeRepository } from '../repositories/employeeRepository.js';

const normalizeRole = (r) => (r || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Resolves the employee profile corresponding to an authenticated user
 */
const resolveRequesterEmployee = async (user) => {
  if (!user || !user.id) return null;

  // 1. Try finding by user_id
  let emp = await employeeRepository.findByUserId(user.id, user.orgId);
  if (emp) return emp;

  // 2. Fall back to matching email within same organization
  if (user.email) {
    emp = await employeeRepository.findByEmail(user.email, user.orgId);
    if (emp) return emp;
  }

  // 3. Fall back without org constraint if user is superadmin
  if (user.email && (user.id === 'user-superadmin-shubham' || normalizeRole(user.roleName) === 'superadmin')) {
    emp = await employeeRepository.findByEmail(user.email);
    if (emp) return emp;
  }

  return null;
};

/**
 * Parse start hour and minute from shift timing string
 * Supports: "03:00 PM - 08:00 PM", "11:00 AM - 07:00 PM", "09:30 AM - 06:30 PM", "15:00 - 23:00", etc.
 */
export const parseShiftStartTime = (shiftTiming) => {
  if (!shiftTiming || typeof shiftTiming !== 'string') {
    return { hour: 11, minute: 0 };
  }
  const match12 = shiftTiming.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = parseInt(match12[2], 10);
    const period = (match12[3] || '').toUpperCase();
    if (period === 'PM' && h < 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return { hour: h, minute: m };
  }
  const match24 = shiftTiming.match(/^(\d{1,2}):(\d{2})/);
  if (match24) {
    return { hour: parseInt(match24[1], 10), minute: parseInt(match24[2], 10) };
  }
  return { hour: 11, minute: 0 };
};

/**
 * Determine if check-in is on time ('PRESENT') or late ('LATE') based on assigned shift and grace window
 * If employee logs in on time or early (e.g. at 02:59 PM for a 03:00 PM shift), status is 'PRESENT'
 * Grace period defaults to 10 minutes after shift start.
 */
export const determineAttendanceStatus = (checkInDate, shiftTiming, timezone = 'Asia/Kolkata', graceMinutes = 10) => {
  const { hour: shiftHour, minute: shiftMin } = parseShiftStartTime(shiftTiming);

  let checkInHour = checkInDate.getHours();
  let checkInMinute = checkInDate.getMinutes();

  try {
    const tz = timezone || 'Asia/Kolkata';
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(checkInDate);
    const hPart = parts.find((p) => p.type === 'hour');
    const mPart = parts.find((p) => p.type === 'minute');
    if (hPart && mPart) {
      let parsedH = parseInt(hPart.value, 10);
      if (parsedH === 24) parsedH = 0;
      checkInHour = parsedH;
      checkInMinute = parseInt(mPart.value, 10);
    }
  } catch {
    // Fall back to serverNow local hours/minutes
  }

  const shiftStartMinutes = shiftHour * 60 + shiftMin;
  let checkInMinutes = checkInHour * 60 + checkInMinute;

  // Handle overnight shift edge case (e.g. Shift starts 11:00 PM, check-in past midnight)
  if (shiftHour >= 18 && checkInHour < 6) {
    checkInMinutes += 24 * 60;
  }

  // If check-in is on or before shift start, or within the 10-min grace period after start
  if (checkInMinutes <= shiftStartMinutes + graceMinutes) {
    return 'PRESENT';
  }

  return 'LATE';
};

export const attendanceService = {
  /**
   * Record Check-In
   */
  async checkIn(user, data = {}, reqIp = '') {
    const normRole = normalizeRole(user.roleName);
    let targetEmployee;

    // Admin and HR can specify an employeeId to record attendance on their behalf
    if (data.employeeId && (normRole === 'admin' || normRole === 'superadmin' || normRole === 'hr' || normRole === 'hrmanager')) {
      targetEmployee = await employeeRepository.findById(data.employeeId);
      if (!targetEmployee) {
        const error = new Error('Specified employee record not found.');
        error.statusCode = 404;
        throw error;
      }
      if (normRole !== 'superadmin' && targetEmployee.orgId !== user.orgId) {
        const error = new Error('Access denied: Cannot record attendance for an employee in a different organization.');
        error.statusCode = 403;
        throw error;
      }
    } else {
      targetEmployee = await resolveRequesterEmployee(user);
      if (!targetEmployee) {
        const error = new Error('No employee profile found for your user account. Please contact your administrator.');
        error.statusCode = 404;
        throw error;
      }
    }

    // Inactive/non-existing employees cannot create attendance
    if (targetEmployee.status && targetEmployee.status.toLowerCase() !== 'active') {
      const error = new Error(`Cannot record attendance: Employee account status is "${targetEmployee.status}". Only active employees can record attendance.`);
      error.statusCode = 403;
      throw error;
    }

    const todayDate = data.date || new Date().toISOString().split('T')[0];
    const serverNow = new Date();

    // Check for existing attendance record for this employee today
    const existing = await attendanceRepository.findByEmployeeAndDate(targetEmployee.id, todayDate, targetEmployee.orgId);

    if (existing && existing.checkIn) {
      const checkInTime = new Date(existing.checkIn).toLocaleTimeString();
      const error = new Error(`Employee has already checked in for today (${todayDate}) at ${checkInTime}. Duplicate check-in is not permitted.`);
      error.statusCode = 409;
      throw error;
    }

    // Determine status accurately based on employee's assigned shift timing and 10-minute grace period
    const shiftTiming = targetEmployee.shiftTiming || data.shiftTiming || '11:00 AM - 07:00 PM';
    const tz = data.timezone || targetEmployee.timezone || 'Asia/Kolkata';
    const status = determineAttendanceStatus(serverNow, shiftTiming, tz, 10);

    if (existing) {
      // If a shell record already exists (e.g. ABSENT or initialized), update it with check-in
      return attendanceRepository.update(existing.id, {
        checkIn: serverNow,
        status,
        source: data.source || existing.source || 'WEB',
        notes: data.notes || existing.notes || '',
        location: data.location || existing.location || {},
      });
    }

    // Create new check-in attendance record
    return attendanceRepository.create({
      orgId: targetEmployee.orgId,
      employeeId: targetEmployee.id,
      attendanceDate: todayDate,
      timezone: data.timezone || 'UTC',
      checkIn: serverNow,
      checkOut: null,
      totalHours: 0.0,
      status,
      shiftId: data.shiftId || null,
      breakDurationMinutes: 0,
      overtimeHours: 0.0,
      source: data.source || 'WEB',
      ipAddress: reqIp || '',
      location: data.location || {},
      notes: data.notes || '',
    });
  },

  /**
   * Record Check-Out
   */
  async checkOut(user, data = {}) {
    const normRole = normalizeRole(user.roleName);
    let targetEmployee;

    if (data.employeeId && (normRole === 'admin' || normRole === 'superadmin' || normRole === 'hr' || normRole === 'hrmanager')) {
      targetEmployee = await employeeRepository.findById(data.employeeId);
      if (!targetEmployee) {
        const error = new Error('Specified employee record not found.');
        error.statusCode = 404;
        throw error;
      }
      if (normRole !== 'superadmin' && targetEmployee.orgId !== user.orgId) {
        const error = new Error('Access denied: Cannot record attendance for an employee in a different organization.');
        error.statusCode = 403;
        throw error;
      }
    } else {
      targetEmployee = await resolveRequesterEmployee(user);
      if (!targetEmployee) {
        const error = new Error('No employee profile found for your user account.');
        error.statusCode = 404;
        throw error;
      }
    }

    // Inactive/non-existing employees cannot create attendance
    if (targetEmployee.status && targetEmployee.status.toLowerCase() !== 'active') {
      const error = new Error(`Cannot record attendance: Employee account status is "${targetEmployee.status}". Only active employees can record attendance.`);
      error.statusCode = 403;
      throw error;
    }

    const todayDate = data.date || new Date().toISOString().split('T')[0];
    const serverNow = new Date();

    const existing = await attendanceRepository.findByEmployeeAndDate(targetEmployee.id, todayDate, targetEmployee.orgId);

    // Validate check-in exists before check-out
    if (!existing || !existing.checkIn) {
      const error = new Error(`Cannot check out: No active check-in record found for today (${todayDate}). You must check in first.`);
      error.statusCode = 400;
      throw error;
    }

    // Validate duplicate check-out
    if (existing.checkOut) {
      const checkOutTime = new Date(existing.checkOut).toLocaleTimeString();
      const error = new Error(`Employee has already checked out for today at ${checkOutTime}. Duplicate check-out is not permitted.`);
      error.statusCode = 409;
      throw error;
    }

    // Validate chronological order: check-out must not be earlier than check-in
    const checkInTime = new Date(existing.checkIn);
    if (serverNow.getTime() < checkInTime.getTime()) {
      const error = new Error('Check-out timestamp cannot be earlier than check-in timestamp.');
      error.statusCode = 400;
      throw error;
    }

    // If currently on break, finalize the break duration
    let breakHistory = Array.isArray(existing.breakHistory) ? [...existing.breakHistory] : [];
    if (existing.isOnBreak && existing.currentBreakStart) {
      const breakStart = new Date(existing.currentBreakStart);
      const diffMs = Math.max(0, serverNow.getTime() - breakStart.getTime());
      const elapsedSeconds = Math.round(diffMs / 1000);
      const elapsedMinutes = Math.max(0, Math.round(diffMs / 60000));
      breakHistory.push({
        startTime: breakStart.toISOString(),
        endTime: serverNow.toISOString(),
        durationSeconds: elapsedSeconds,
        durationMinutes: elapsedMinutes,
      });
    }

    // Accurately compute total break from all break sessions
    const totalBreakSeconds = breakHistory.reduce(
      (sum, item) => sum + (item.durationSeconds !== undefined ? Number(item.durationSeconds) : ((Number(item.durationMinutes) || 0) * 60)),
      0
    );
    const calculatedBreakMinutes = Math.round(totalBreakSeconds / 60);

    // If caller explicitly passed a custom break duration override (e.g. admin regularization), use it, otherwise dynamically calculated:
    const breakMinutes = (data.breakDurationMinutes !== undefined && data.breakDurationMinutes !== null && data.breakDurationMinutes !== '')
      ? parseInt(data.breakDurationMinutes, 10)
      : calculatedBreakMinutes;

    // Calculate total net working hours down to the second
    const grossDurationMs = Math.max(0, serverNow.getTime() - checkInTime.getTime());
    const grossSeconds = Math.floor(grossDurationMs / 1000);
    const effectiveBreakSeconds = (data.breakDurationMinutes !== undefined && data.breakDurationMinutes !== null && data.breakDurationMinutes !== '')
      ? breakMinutes * 60
      : totalBreakSeconds;
    const netSeconds = Math.max(0, grossSeconds - effectiveBreakSeconds);
    const totalHours = parseFloat((netSeconds / 3600).toFixed(2));

    // Calculate overtime if applicable (> 8 hours standard work day)
    const overtimeHours = totalHours > 8.0 ? parseFloat((totalHours - 8.0).toFixed(2)) : 0.0;

    // Determine final status
    let finalStatus = 'PRESENT';
    if (totalHours < 4.0) {
      finalStatus = 'HALF_DAY';
    } else {
      // Re-validate against shift timing to ensure accurate status
      const shiftTiming = targetEmployee.shiftTiming || data.shiftTiming || '11:00 AM - 07:00 PM';
      const tz = data.timezone || existing.timezone || targetEmployee.timezone || 'Asia/Kolkata';
      finalStatus = existing.checkIn
        ? determineAttendanceStatus(new Date(existing.checkIn), shiftTiming, tz, 10)
        : existing.status;
    }

    // Notes accumulation
    const updatedNotes = data.notes
      ? existing.notes
        ? `${existing.notes} | ${data.notes}`
        : data.notes
      : existing.notes;

    return attendanceRepository.update(existing.id, {
      checkOut: serverNow,
      totalHours,
      status: finalStatus,
      isOnBreak: false,
      currentBreakStart: null,
      breakHistory,
      breakDurationMinutes: breakMinutes,
      overtimeHours,
      notes: updatedNotes,
      location: data.location || existing.location,
    });
  },

  /**
   * Pause working session for a break
   */
  async pauseBreak(user) {
    const targetEmployee = await resolveRequesterEmployee(user);
    if (!targetEmployee) {
      const error = new Error('No employee profile found for your user account.');
      error.statusCode = 404;
      throw error;
    }

    const todayDate = new Date().toISOString().split('T')[0];
    const existing = await attendanceRepository.findByEmployeeAndDate(targetEmployee.id, todayDate, targetEmployee.orgId);

    if (!existing || !existing.checkIn) {
      const error = new Error('Cannot pause: You must log in first before taking a break.');
      error.statusCode = 400;
      throw error;
    }

    if (existing.checkOut) {
      const error = new Error('Cannot pause: You have already logged out for today.');
      error.statusCode = 400;
      throw error;
    }

    if (existing.isOnBreak) {
      const error = new Error('You are already on break.');
      error.statusCode = 400;
      throw error;
    }

    return attendanceRepository.update(existing.id, {
      isOnBreak: true,
      currentBreakStart: new Date(),
    });
  },

  /**
   * Resume working session after break
   */
  async resumeBreak(user) {
    const targetEmployee = await resolveRequesterEmployee(user);
    if (!targetEmployee) {
      const error = new Error('No employee profile found for your user account.');
      error.statusCode = 404;
      throw error;
    }

    const todayDate = new Date().toISOString().split('T')[0];
    const existing = await attendanceRepository.findByEmployeeAndDate(targetEmployee.id, todayDate, targetEmployee.orgId);

    if (!existing || !existing.checkIn) {
      const error = new Error('Cannot resume: No active login session found.');
      error.statusCode = 400;
      throw error;
    }

    if (!existing.isOnBreak) {
      const error = new Error('You are not currently on break.');
      error.statusCode = 400;
      throw error;
    }

    const serverNow = new Date();
    const breakStart = existing.currentBreakStart ? new Date(existing.currentBreakStart) : serverNow;
    const diffMs = Math.max(0, serverNow.getTime() - breakStart.getTime());
    const elapsedSeconds = Math.round(diffMs / 1000);
    const elapsedMinutes = Math.max(0, Math.round(diffMs / 60000));

    const breakHistory = Array.isArray(existing.breakHistory) ? [...existing.breakHistory] : [];
    breakHistory.push({
      startTime: breakStart.toISOString(),
      endTime: serverNow.toISOString(),
      durationSeconds: elapsedSeconds,
      durationMinutes: elapsedMinutes,
    });

    const totalBreakSeconds = breakHistory.reduce(
      (sum, item) => sum + (item.durationSeconds !== undefined ? Number(item.durationSeconds) : ((Number(item.durationMinutes) || 0) * 60)),
      0
    );
    const totalBreakMinutes = Math.round(totalBreakSeconds / 60);

    return attendanceRepository.update(existing.id, {
      isOnBreak: false,
      currentBreakStart: null,
      breakDurationMinutes: totalBreakMinutes,
      breakHistory,
    });
  },

  /**
   * Get authenticated employee's own attendance history
   */
  async getMyAttendance(user, query = {}) {
    const employee = await resolveRequesterEmployee(user);
    if (!employee) {
      const error = new Error('No employee profile found for your user account.');
      error.statusCode = 404;
      throw error;
    }

    const history = await attendanceRepository.findByEmployeeHistory(employee.id, employee.orgId, query);
    return {
      ...history,
      employeeProfile: {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        employeeCode: employee.employeeCode,
        shiftTiming: employee.shiftTiming || '11:00 AM - 07:00 PM',
      },
    };
  },

  /**
   * Get single attendance record by ID with strict IDOR protection
   */
  async getById(user, id) {
    const record = await attendanceRepository.findById(id);
    if (!record) {
      const error = new Error('Attendance record not found.');
      error.statusCode = 404;
      throw error;
    }

    const normRole = normalizeRole(user.roleName);

    // Organization boundary check
    if (normRole !== 'superadmin' && record.orgId !== user.orgId) {
      const error = new Error('Access denied: Attendance record belongs to a different organization.');
      error.statusCode = 403;
      throw error;
    }

    // Role-based IDOR enforcement
    if (normRole === 'admin' || normRole === 'superadmin' || normRole === 'hr' || normRole === 'hrmanager') {
      return record;
    }

    const requesterEmp = await resolveRequesterEmployee(user);
    if (!requesterEmp) {
      const error = new Error('Access denied: No employee profile found for requester.');
      error.statusCode = 403;
      throw error;
    }

    // If requester is the record owner, allow access
    if (record.employeeId === requesterEmp.id) {
      return record;
    }

    // If requester is a Manager, allow access ONLY IF employee is in manager's department
    if (normRole === 'manager') {
      if (requesterEmp.deptId && record.employee && record.employee.deptId === requesterEmp.deptId) {
        return record;
      }
      const error = new Error("Access denied: You can only view attendance records for employees in your department.");
      error.statusCode = 403;
      throw error;
    }

    // Standard employee is strictly forbidden from viewing other employees' records
    const error = new Error("Access denied: You are not authorized to view another employee's attendance record.");
    error.statusCode = 403;
    throw error;
  },

  /**
   * Get team attendance for Manager (scoped to manager's department)
   */
  async getTeamAttendance(user, query = {}) {
    const normRole = normalizeRole(user.roleName);
    let deptId = query.deptId || null;

    if (normRole === 'manager') {
      const managerEmp = await resolveRequesterEmployee(user);
      if (!managerEmp) {
        const error = new Error('Manager employee profile not found.');
        error.statusCode = 404;
        throw error;
      }
      if (!managerEmp.deptId) {
        return {
          records: [],
          pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
          message: 'No department assigned to current manager.',
        };
      }
      // Manager can ONLY see their own department
      deptId = managerEmp.deptId;
    }

    return attendanceRepository.findTeamAttendance(deptId, user.orgId, query);
  },

  /**
   * Get organization-wide attendance for HR & Admin
   */
  async getOrgAttendance(user, query = {}) {
    const normRole = normalizeRole(user.roleName);
    if (normRole !== 'admin' && normRole !== 'superadmin' && normRole !== 'hr' && normRole !== 'hrmanager') {
      const error = new Error('Access denied: Requires HR or Admin authorization.');
      error.statusCode = 403;
      throw error;
    }

    const [attendanceData, summary] = await Promise.all([
      attendanceRepository.findAllOrgAttendance(user.orgId, query),
      attendanceRepository.getDailySummary(user.orgId, query.date),
    ]);

    return {
      summary,
      ...attendanceData,
    };
  },

  /**
   * Regularize an attendance record (Admin, HR, Manager)
   */
  async regularize(user, id, data) {
    const record = await attendanceRepository.findById(id);
    if (!record) {
      const error = new Error('Attendance record not found.');
      error.statusCode = 404;
      throw error;
    }

    const normRole = normalizeRole(user.roleName);

    // Organization boundary check
    if (normRole !== 'superadmin' && record.orgId !== user.orgId) {
      const error = new Error('Access denied: Attendance record belongs to a different organization.');
      error.statusCode = 403;
      throw error;
    }

    // Manager boundary check: can regularize only department members
    if (normRole === 'manager') {
      const managerEmp = await resolveRequesterEmployee(user);
      if (!managerEmp || !managerEmp.deptId || !record.employee || record.employee.deptId !== managerEmp.deptId) {
        const error = new Error('Access denied: Managers can only regularize attendance for members in their department.');
        error.statusCode = 403;
        throw error;
      }
    }

    // Compute updated hours if check-in or check-out adjusted
    const newCheckIn = data.checkIn ? new Date(data.checkIn) : record.checkIn ? new Date(record.checkIn) : null;
    const newCheckOut = data.checkOut ? new Date(data.checkOut) : record.checkOut ? new Date(record.checkOut) : null;

    let totalHours = record.totalHours;
    let overtimeHours = record.overtimeHours;

    if (newCheckIn && newCheckOut) {
      if (newCheckOut.getTime() < newCheckIn.getTime()) {
        const error = new Error('Check-out timestamp cannot be earlier than check-in timestamp.');
        error.statusCode = 400;
        throw error;
      }
      const durationMs = newCheckOut.getTime() - newCheckIn.getTime();
      const grossHours = durationMs / (1000 * 60 * 60);
      const breakMinutes = record.breakDurationMinutes || 0;
      const netHours = Math.max(0, grossHours - breakMinutes / 60);
      totalHours = parseFloat(netHours.toFixed(2));
      overtimeHours = totalHours > 8.0 ? parseFloat((totalHours - 8.0).toFixed(2)) : 0.0;
    }

    return attendanceRepository.update(id, {
      checkIn: newCheckIn,
      checkOut: newCheckOut,
      totalHours,
      overtimeHours,
      status: data.status || 'REGULARIZED',
      isRegularized: true,
      regularizationReason: data.regularizationReason,
      regularizedBy: user.id,
      regularizedAt: new Date(),
      notes: data.notes ? (record.notes ? `${record.notes} | ${data.notes}` : data.notes) : record.notes,
    });
  },
};
