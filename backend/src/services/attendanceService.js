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
 * Parse start, end, and scheduled duration hours from shift timing string
 * Supports: "11:00 AM - 07:00 PM", "09:00 AM - 05:00 PM", "03:00 PM - 08:00 PM", "21:00 - 05:00", etc.
 */
export const parseShiftTiming = (shiftTiming) => {
  const defaultShift = {
    startHour: 11,
    startMinute: 0,
    endHour: 19,
    endMinute: 0,
    scheduledDurationHours: 8.0,
  };

  if (!shiftTiming || typeof shiftTiming !== 'string') {
    return defaultShift;
  }

  const parts = shiftTiming.split('-');
  if (parts.length !== 2) {
    const start = parseShiftStartTime(shiftTiming);
    const endH = (start.hour + 8) % 24;
    return {
      startHour: start.hour,
      startMinute: start.minute,
      endHour: endH,
      endMinute: start.minute,
      scheduledDurationHours: 8.0,
    };
  }

  const parseTimeStr = (str) => {
    const trimmed = str.trim();
    const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (match12) {
      let h = parseInt(match12[1], 10);
      const m = parseInt(match12[2], 10);
      const period = (match12[3] || '').toUpperCase();
      if (period === 'PM' && h < 12) h += 12;
      if (period === 'AM' && h === 12) h = 0;
      return { hour: h, minute: m };
    }
    const match24 = trimmed.match(/^(\d{1,2}):(\d{2})/);
    if (match24) {
      return { hour: parseInt(match24[1], 10), minute: parseInt(match24[2], 10) };
    }
    return null;
  };

  const start = parseTimeStr(parts[0]);
  const end = parseTimeStr(parts[1]);

  if (!start || !end) {
    return defaultShift;
  }

  let startMinutes = start.hour * 60 + start.minute;
  let endMinutes = end.hour * 60 + end.minute;

  if (endMinutes <= startMinutes) {
    // Overnight shift crossing midnight (e.g. 9 PM to 5 AM)
    endMinutes += 24 * 60;
  }

  const durationHours = parseFloat(((endMinutes - startMinutes) / 60).toFixed(2));

  return {
    startHour: start.hour,
    startMinute: start.minute,
    endHour: end.hour,
    endMinute: end.minute,
    scheduledDurationHours: durationHours > 0 ? durationHours : 8.0,
  };
};

/**
 * Calculate the auto-logout cutoff time for a given check-in and shift timing.
 * Cutoff: 10 hours after the scheduled shift end.
 */
export const calculateAutoLogoutCutoff = (record, shiftTiming, timezone = 'Asia/Kolkata') => {
  if (!record || !record.checkIn) return null;

  const checkInDate = new Date(record.checkIn);
  const shift = parseShiftTiming(shiftTiming);

  let dateParts = [];
  if (record.attendanceDate && typeof record.attendanceDate === 'string') {
    dateParts = record.attendanceDate.split('T')[0].split('-').map(Number);
  } else if (record.attendanceDate instanceof Date) {
    dateParts = [record.attendanceDate.getFullYear(), record.attendanceDate.getMonth() + 1, record.attendanceDate.getDate()];
  } else {
    dateParts = [checkInDate.getFullYear(), checkInDate.getMonth() + 1, checkInDate.getDate()];
  }

  const [year, month, day] = dateParts;
  const isOvernight = shift.endHour < shift.startHour || (shift.endHour === shift.startHour && shift.endMinute <= shift.startMinute);

  const shiftEndDate = new Date(year, month - 1, day, shift.endHour, shift.endMinute, 0);
  if (isOvernight) {
    shiftEndDate.setDate(shiftEndDate.getDate() + 1);
  }

  // Handle late check-ins where employee clocked in after scheduled shift end
  const dynamicShiftEnd = new Date(checkInDate.getTime() + shift.scheduledDurationHours * 3600 * 1000);
  const effectiveShiftEnd = new Date(Math.max(shiftEndDate.getTime(), dynamicShiftEnd.getTime()));

  // Auto-logout cutoff is exactly 10 hours after shift ends
  const cutoff = new Date(effectiveShiftEnd.getTime() + 10 * 3600 * 1000);
  return cutoff;
};

/**
 * Checks an unclosed attendance record and automatically logs out the employee if 10h post-shift passed
 */
export const checkAndAutoLogoutRecord = async (record, shiftTimingOverride = null) => {
  if (!record || !record.checkIn || record.checkOut) {
    return record;
  }

  const shiftTiming = shiftTimingOverride || record.employee?.shiftTiming || '11:00 AM - 07:00 PM';
  const cutoff = calculateAutoLogoutCutoff(record, shiftTiming, record.timezone);
  if (!cutoff) return record;

  const now = new Date();
  if (now.getTime() < cutoff.getTime()) {
    return record;
  }

  // Threshold exceeded! Automatically finalize logout for the day
  const checkInTime = new Date(record.checkIn);
  const shift = parseShiftTiming(shiftTiming);

  // If currently on break, close open break at cutoff time
  let breakHistory = Array.isArray(record.breakHistory) ? [...record.breakHistory] : [];
  if (record.isOnBreak && record.currentBreakStart) {
    const breakStart = new Date(record.currentBreakStart);
    const breakEnd = new Date(Math.min(now.getTime(), cutoff.getTime()));
    const diffMs = Math.max(0, breakEnd.getTime() - breakStart.getTime());
    breakHistory.push({
      startTime: breakStart.toISOString(),
      endTime: breakEnd.toISOString(),
      durationSeconds: Math.round(diffMs / 1000),
      durationMinutes: Math.round(diffMs / 60000),
    });
  }

  const totalBreakSeconds = breakHistory.reduce(
    (sum, item) => sum + (item.durationSeconds !== undefined ? Number(item.durationSeconds) : ((Number(item.durationMinutes) || 0) * 60)),
    0
  );
  const totalBreakMinutes = Math.round(totalBreakSeconds / 60);

  // Total working time capped at the 10h post-shift cutoff
  const grossSeconds = Math.max(0, Math.floor((cutoff.getTime() - checkInTime.getTime()) / 1000));
  const netSeconds = Math.max(0, grossSeconds - totalBreakSeconds);
  const totalHours = parseFloat((netSeconds / 3600).toFixed(2));

  // Overtime: all work hours beyond scheduled shift duration
  const scheduledHours = shift.scheduledDurationHours || 8.0;
  const overtimeHours = totalHours > scheduledHours ? parseFloat((totalHours - scheduledHours).toFixed(2)) : 0.0;

  const autoLogoutNote = '[SYSTEM_AUTO_LOGOUT] Automatically logged out 10 hours after shift completed. [NEEDS_POST_SHIFT_REMARK]';
  const updatedNotes = record.notes
    ? `${record.notes} | ${autoLogoutNote}`
    : autoLogoutNote;

  const updated = await attendanceRepository.update(record.id, {
    checkOut: cutoff,
    totalHours,
    overtimeHours,
    isOnBreak: false,
    currentBreakStart: null,
    breakHistory,
    breakDurationMinutes: totalBreakMinutes,
    status: record.status || 'PRESENT',
    notes: updatedNotes,
  });

  return updated;
};

/**
 * Scans active unclosed records and auto-checks out any records exceeding shift + 10 hours
 */
export const autoCheckoutStaleRecords = async (orgId = null) => {
  try {
    const openRecords = await attendanceRepository.findActiveUnclosedRecords(orgId);
    if (!openRecords || openRecords.length === 0) return 0;

    let autoClosedCount = 0;
    const now = new Date();

    for (const rec of openRecords) {
      const shiftTiming = rec.employee?.shiftTiming || '11:00 AM - 07:00 PM';
      const cutoff = calculateAutoLogoutCutoff(rec, shiftTiming, rec.timezone);
      if (cutoff && now.getTime() >= cutoff.getTime()) {
        await checkAndAutoLogoutRecord(rec, shiftTiming);
        autoClosedCount++;
      }
    }
    return autoClosedCount;
  } catch (err) {
    console.error('Error in autoCheckoutStaleRecords:', err.message);
    return 0;
  }
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
    const shiftTiming = targetEmployee.shiftTiming || data.shiftTiming || '11:00 AM - 07:00 PM';

    // Auto-resolve any prior open records for targetEmployee exceeding cutoff
    try {
      const unclosed = await attendanceRepository.findActiveUnclosedRecords(targetEmployee.orgId);
      for (const rec of unclosed) {
        if (rec.employeeId === targetEmployee.id) {
          await checkAndAutoLogoutRecord(rec, shiftTiming);
        }
      }
    } catch {
      // Non-blocking
    }

    // Check for existing attendance record for this employee today
    let existing = await attendanceRepository.findByEmployeeAndDate(targetEmployee.id, todayDate, targetEmployee.orgId);

    if (existing && existing.checkIn && !existing.checkOut) {
      // Check if this existing record is already past cutoff
      const cutoff = calculateAutoLogoutCutoff(existing, shiftTiming, existing.timezone || targetEmployee.timezone);
      if (cutoff && serverNow.getTime() >= cutoff.getTime()) {
        existing = await checkAndAutoLogoutRecord(existing, shiftTiming);
      }
    }

    if (existing && existing.checkIn && !existing.checkOut) {
      const checkInTime = new Date(existing.checkIn).toLocaleTimeString();
      const error = new Error(`Employee has already checked in for today (${todayDate}) at ${checkInTime}. Duplicate check-in is not permitted.`);
      error.statusCode = 409;
      throw error;
    }

    // Determine status accurately based on employee's assigned shift timing and 10-minute grace period
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
    const shiftTiming = targetEmployee.shiftTiming || data.shiftTiming || '11:00 AM - 07:00 PM';

    let existing = await attendanceRepository.findByEmployeeAndDate(targetEmployee.id, todayDate, targetEmployee.orgId);

    // If not found for todayDate, also check for any open check-in across previous dates for this employee
    if (!existing || !existing.checkIn) {
      const unclosed = await attendanceRepository.findActiveUnclosedRecords(targetEmployee.orgId);
      const openRec = unclosed.find((r) => r.employeeId === targetEmployee.id);
      if (openRec) {
        existing = openRec;
      }
    }

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

    // Check if session has exceeded shift + 10 hours auto-logout threshold
    const cutoff = calculateAutoLogoutCutoff(existing, shiftTiming, existing.timezone || targetEmployee.timezone);
    if (cutoff && serverNow.getTime() >= cutoff.getTime()) {
      return checkAndAutoLogoutRecord(existing, shiftTiming);
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

    // Calculate overtime beyond scheduled shift duration (universal for all roles)
    const shiftInfo = parseShiftTiming(shiftTiming);
    const scheduledHours = shiftInfo.scheduledDurationHours || 8.0;
    const overtimeHours = totalHours > scheduledHours ? parseFloat((totalHours - scheduledHours).toFixed(2)) : 0.0;

    // Determine final status
    let finalStatus = 'PRESENT';
    if (totalHours < 4.0) {
      finalStatus = 'HALF_DAY';
    } else {
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

    // Auto-resolve any active unclosed records for this employee that exceeded the 10h post-shift cutoff
    try {
      const unclosed = await attendanceRepository.findActiveUnclosedRecords(employee.orgId);
      for (const rec of unclosed) {
        if (rec.employeeId === employee.id) {
          await checkAndAutoLogoutRecord(rec, employee.shiftTiming);
        }
      }
    } catch {
      // Non-blocking
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

    // Automatically resolve stale sessions before returning team view
    await autoCheckoutStaleRecords(user.orgId);

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

    // Automatically resolve stale sessions across organization before returning view
    await autoCheckoutStaleRecords(user.orgId);

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
      const shiftInfo = parseShiftTiming(record.employee?.shiftTiming || '11:00 AM - 07:00 PM');
      const scheduledHours = shiftInfo.scheduledDurationHours || 8.0;
      overtimeHours = totalHours > scheduledHours ? parseFloat((totalHours - scheduledHours).toFixed(2)) : 0.0;
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

  /**
   * Add an Emergency or OT remark on an attendance session (Admin, HR, Manager)
   * Specifically for sessions that logged out after 10 hours post-shift.
   */
  async addShiftRemark(user, id, { remarkType, comments }) {
    const record = await attendanceRepository.findById(id);
    if (!record) {
      const error = new Error('Attendance record not found.');
      error.statusCode = 404;
      throw error;
    }

    const normRole = normalizeRole(user.roleName);
    const allowedRoles = ['admin', 'hr', 'manager', 'superadmin', 'hrmanager', 'orgadmin'];
    if (!allowedRoles.includes(normRole)) {
      const error = new Error('Access denied: Only Admin, HR, and Manager can add shift remarks.');
      error.statusCode = 403;
      throw error;
    }

    // Organization boundary check
    if (normRole !== 'superadmin' && record.orgId !== user.orgId) {
      const error = new Error('Access denied: Attendance record belongs to a different organization.');
      error.statusCode = 403;
      throw error;
    }

    // Manager boundary check: can remark only department members
    if (normRole === 'manager') {
      const managerEmp = await resolveRequesterEmployee(user);
      if (!managerEmp || !managerEmp.deptId || !record.employee || record.employee.deptId !== managerEmp.deptId) {
        const error = new Error('Access denied: Managers can only add remarks for members in their department.');
        error.statusCode = 403;
        throw error;
      }
    }

    const typeNormalized = (remarkType || '').trim().toUpperCase();
    if (!['EMERGENCY', 'OT'].includes(typeNormalized)) {
      const error = new Error("Invalid remark type. Must be either 'EMERGENCY' or 'OT'.");
      error.statusCode = 400;
      throw error;
    }

    if (!comments || typeof comments !== 'string' || comments.trim().length < 3) {
      const error = new Error('Remark comments must be at least 3 characters long.');
      error.statusCode = 400;
      throw error;
    }

    const reviewerName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Authorized Reviewer';
    const cleanComment = comments.trim();
    const timestampIso = new Date().toISOString();

    const remarkAuditTag = `[POST_SHIFT_REMARK: ${typeNormalized}] Review by ${reviewerName} (${user.roleName || 'Reviewer'}) at ${timestampIso}: "${cleanComment}"`;

    // Strip [NEEDS_POST_SHIFT_REMARK] if present from existing notes, then append new remark
    let currentNotes = (record.notes || '').replace(/\[NEEDS_POST_SHIFT_REMARK\]/g, '').trim();
    // Also remove trailing or double pipes if any
    currentNotes = currentNotes.replace(/\s*\|\s*$/, '').trim();
    const updatedNotes = currentNotes ? `${currentNotes} | ${remarkAuditTag}` : remarkAuditTag;

    const regularizationReason = `[${typeNormalized}] ${cleanComment}`;

    const updatedRecord = await attendanceRepository.update(id, {
      isRegularized: true,
      regularizationReason,
      regularizedBy: user.id,
      regularizedAt: new Date(),
      notes: updatedNotes,
    });

    return updatedRecord;
  },
};

