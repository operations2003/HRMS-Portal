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

  // 3. Fall back without org constraint if user is superadmin or admin
  if (user.email && (user.id === 'user-superadmin-shubham' || normalizeRole(user.roleName) === 'superadmin' || normalizeRole(user.roleName) === 'admin')) {
    emp = await employeeRepository.findByEmail(user.email);
    if (emp) return emp;
  }

  return null;
};

/**
 * Parse a time string into 24-hour hour and minute
 * Handles:
 *   - 12-hour AM/PM: "1:00 AM", "01:00 AM", "11:34 PM", "12:00 AM" (0:00), "12:00 PM" (12:00)
 *   - 24-hour: "13:00", "23:34", "07:00", "00:15"
 */
export const parseTimeStr = (str) => {
  if (!str || typeof str !== 'string') return null;
  const trimmed = str.trim();
  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
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

/**
 * Parse start hour and minute from shift timing string
 * Supports: "03:00 PM - 08:00 PM", "1:00 AM - 7:00 PM", "11:00 AM to 07:00 PM", "15:00 - 23:00", etc.
 */
export const parseShiftStartTime = (shiftTiming) => {
  if (!shiftTiming || typeof shiftTiming !== 'string') {
    return { hour: 11, minute: 0 };
  }
  const parts = shiftTiming.split(/\s*[-–—]|\s+to\s+/i).map((s) => s.trim()).filter(Boolean);
  const startStr = parts.length > 0 ? parts[0] : shiftTiming;
  const parsed = parseTimeStr(startStr);
  return parsed || { hour: 11, minute: 0 };
};

/**
 * Parse start, end, overnight flag, and scheduled duration hours from shift timing string.
 * Supports:
 *   - 12-hour: "01:00 AM - 07:00 PM", "1:00 AM–7:00 PM", "11:00 AM to 07:00 PM", "06:08 PM - 07:00 AM"
 *   - 24-hour: "21:00 - 05:00", "09:30 - 18:30"
 *   - Midnight / noon edges: "12:00 AM - 08:00 AM", "12:00 PM - 08:00 PM"
 */
export const parseShiftTiming = (shiftTiming) => {
  const defaultShift = {
    startHour: 11,
    startMinute: 0,
    endHour: 19,
    endMinute: 0,
    scheduledDurationHours: 8.0,
    isOvernight: false,
  };

  if (!shiftTiming || typeof shiftTiming !== 'string') {
    return defaultShift;
  }

  const parts = shiftTiming.split(/\s*[-–—]|\s+to\s+/i).map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) {
    const start = parseShiftStartTime(shiftTiming);
    const endH = (start.hour + 8) % 24;
    return {
      startHour: start.hour,
      startMinute: start.minute,
      endHour: endH,
      endMinute: start.minute,
      scheduledDurationHours: 8.0,
      isOvernight: endH < start.hour,
    };
  }

  const start = parseTimeStr(parts[0]);
  const end = parseTimeStr(parts[1]);

  if (!start || !end) {
    return defaultShift;
  }

  let startMinutes = start.hour * 60 + start.minute;
  let endMinutes = end.hour * 60 + end.minute;
  let isOvernight = false;

  if (endMinutes <= startMinutes) {
    // Overnight shift crossing midnight (e.g. 06:08 PM to 07:00 AM, 09:00 PM to 05:00 AM)
    endMinutes += 24 * 60;
    isOvernight = true;
  }

  const durationHours = parseFloat(((endMinutes - startMinutes) / 60).toFixed(2));

  return {
    startHour: start.hour,
    startMinute: start.minute,
    endHour: end.hour,
    endMinute: end.minute,
    scheduledDurationHours: durationHours > 0 ? durationHours : 8.0,
    isOvernight,
  };
};

/**
 * Universal deterministic calculation of actual working duration and overtime.
 *
 * Rules:
 *   1. Working duration = Actual Login to Actual Logout (grossSeconds)
 *   2. Subtract recorded break duration (totalBreakSeconds) -> netSeconds
 *   3. Overtime = Work duration beyond assigned shift duration (totalHours - scheduledShiftDuration)
 *   4. If totalHours <= scheduledShiftDuration, overtime is strictly 0.00
 *   5. Never produces negative durations or impossible values.
 */
export const calculateWorkingHoursAndOvertime = ({
  checkIn,
  checkOut,
  breakHistory = [],
  breakDurationMinutes = null,
  shiftTiming = '11:00 AM - 07:00 PM',
}) => {
  if (!checkIn) {
    return {
      grossSeconds: 0,
      grossHours: 0.0,
      breakDurationMinutes: 0,
      totalBreakSeconds: 0,
      totalHours: 0.0,
      overtimeHours: 0.0,
      scheduledDurationHours: 8.0,
    };
  }

  const inDate = checkIn instanceof Date ? checkIn : new Date(checkIn);
  if (isNaN(inDate.getTime())) {
    return {
      grossSeconds: 0,
      grossHours: 0.0,
      breakDurationMinutes: 0,
      totalBreakSeconds: 0,
      totalHours: 0.0,
      overtimeHours: 0.0,
      scheduledDurationHours: 8.0,
    };
  }

  const shiftInfo = parseShiftTiming(shiftTiming);
  const scheduledHours = shiftInfo.scheduledDurationHours || 8.0;

  if (!checkOut) {
    return {
      grossSeconds: 0,
      grossHours: 0.0,
      breakDurationMinutes: Number(breakDurationMinutes) || 0,
      totalBreakSeconds: (Number(breakDurationMinutes) || 0) * 60,
      totalHours: 0.0,
      overtimeHours: 0.0,
      scheduledDurationHours: scheduledHours,
    };
  }

  const outDate = checkOut instanceof Date ? checkOut : new Date(checkOut);
  if (isNaN(outDate.getTime())) {
    return {
      grossSeconds: 0,
      grossHours: 0.0,
      breakDurationMinutes: Number(breakDurationMinutes) || 0,
      totalBreakSeconds: (Number(breakDurationMinutes) || 0) * 60,
      totalHours: 0.0,
      overtimeHours: 0.0,
      scheduledDurationHours: scheduledHours,
    };
  }

  // Gross duration between actual check-in and actual check-out
  let grossMs = outDate.getTime() - inDate.getTime();
  if (grossMs < 0) grossMs = 0;
  const grossSeconds = Math.floor(grossMs / 1000);
  const grossHours = parseFloat((grossSeconds / 3600).toFixed(2));

  // Break duration: sum from completed sessions in breakHistory
  let totalBreakSeconds = 0;
  if (Array.isArray(breakHistory) && breakHistory.length > 0) {
    for (const b of breakHistory) {
      if (b.durationSeconds !== undefined && b.durationSeconds !== null) {
        totalBreakSeconds += Number(b.durationSeconds);
      } else if (b.durationMinutes !== undefined && b.durationMinutes !== null) {
        totalBreakSeconds += Number(b.durationMinutes) * 60;
      } else if (b.startTime && b.endTime) {
        const diff = Math.floor((new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 1000);
        if (diff > 0) totalBreakSeconds += diff;
      }
    }
  }

  // Check if explicit breakDurationMinutes provides additional / overridden duration
  const explicitBreakMinutes = parseInt(breakDurationMinutes, 10);
  if (!isNaN(explicitBreakMinutes) && explicitBreakMinutes > 0) {
    const explicitSecs = explicitBreakMinutes * 60;
    if (explicitSecs > totalBreakSeconds) {
      totalBreakSeconds = explicitSecs;
    }
  }

  // Break cannot exceed gross working duration
  const effectiveBreakSeconds = Math.min(grossSeconds, totalBreakSeconds);
  const finalBreakMinutes = Math.round(effectiveBreakSeconds / 60);

  // Net working seconds and hours
  const netSeconds = Math.max(0, grossSeconds - effectiveBreakSeconds);
  const totalHours = parseFloat((netSeconds / 3600).toFixed(2));

  // Overtime: only hours worked strictly beyond the assigned shift duration
  const overtimeHours = totalHours > scheduledHours
    ? parseFloat((totalHours - scheduledHours).toFixed(2))
    : 0.0;

  return {
    grossSeconds,
    grossHours,
    breakDurationMinutes: finalBreakMinutes,
    totalBreakSeconds: effectiveBreakSeconds,
    totalHours,
    overtimeHours,
    scheduledDurationHours: scheduledHours,
  };
};

/**
 * Construct a UTC Date corresponding to a specific local year, month, day, hour, minute, second
 * within the specified timezone (default 'Asia/Kolkata')
 */
export const createDateInTimezone = (y, m, d, h, min, s = 0, timezone = 'Asia/Kolkata') => {
  const tempUtc = new Date(Date.UTC(y, m - 1, d, h, min, s));
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'Asia/Kolkata',
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(tempUtc);
    const p = {};
    parts.forEach((pt) => { p[pt.type] = parseInt(pt.value, 10); });
    if (p.hour === 24) p.hour = 0;
    const inTzAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const offsetMs = inTzAsUtc - tempUtc.getTime();
    return new Date(tempUtc.getTime() - offsetMs);
  } catch {
    return new Date(y, m - 1, d, h, min, s);
  }
};

/**
 * Calculate the auto-logout cutoff time for a given check-in and shift timing.
 * Cutoff: 10 hours after the scheduled shift end.
 */
export const calculateAutoLogoutCutoff = (record, shiftTiming, timezone = 'Asia/Kolkata') => {
  if (!record || !record.checkIn) return null;

  const checkInDate = new Date(record.checkIn);
  if (isNaN(checkInDate.getTime())) return null;

  const shift = parseShiftTiming(shiftTiming);
  const tz = timezone || 'Asia/Kolkata';

  // Extract calendar date (YYYY-MM-DD) in employee timezone
  let dateStr = '';
  if (record.attendanceDate) {
    if (typeof record.attendanceDate === 'string') {
      dateStr = record.attendanceDate.split('T')[0];
    } else if (record.attendanceDate instanceof Date) {
      dateStr = record.attendanceDate.toISOString().split('T')[0];
    }
  }
  if (!dateStr || dateStr.length !== 10) {
    try {
      dateStr = checkInDate.toLocaleDateString('en-CA', { timeZone: tz });
    } catch {
      dateStr = checkInDate.toISOString().split('T')[0];
    }
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  const shiftStartDate = createDateInTimezone(year, month, day, shift.startHour, shift.startMinute, 0, tz);
  const shiftEndDate = createDateInTimezone(year, month, shift.isOvernight ? day + 1 : day, shift.endHour, shift.endMinute, 0, tz);

  let effectiveShiftEnd = shiftEndDate;
  // If employee checked in late (after scheduled shift start), extend dynamically
  if (checkInDate.getTime() > shiftStartDate.getTime()) {
    const dynamicShiftEnd = new Date(checkInDate.getTime() + Math.round(shift.scheduledDurationHours * 3600 * 1000));
    effectiveShiftEnd = new Date(Math.max(shiftEndDate.getTime(), dynamicShiftEnd.getTime()));
  }

  // Auto-logout cutoff is exactly 10 hours after shift ends
  const cutoff = new Date(effectiveShiftEnd.getTime() + 10 * 3600 * 1000);
  return cutoff;
};

/**
 * Checks an unclosed attendance record and automatically logs out the employee if 10h post-shift passed
 * @param {Object} record - The attendance record
 * @param {string|null} shiftTimingOverride - Optional shift timing string
 * @param {boolean} forceCheckout - If true, immediately finalizes the unclosed record (e.g. when checking in on a new day)
 */
export const checkAndAutoLogoutRecord = async (record, shiftTimingOverride = null, forceCheckout = false) => {
  if (!record || !record.checkIn || record.checkOut) {
    return record;
  }

  const shiftTiming = shiftTimingOverride || record.employee?.shiftTiming || '11:00 AM - 07:00 PM';
  const cutoff = calculateAutoLogoutCutoff(record, shiftTiming, record.timezone);
  if (!cutoff) return record;

  const now = new Date();
  if (!forceCheckout && now.getTime() < cutoff.getTime()) {
    return record;
  }

  // Finalize checkout timestamp at cutoff (or now if forced earlier)
  const effectiveCheckOut = new Date(Math.min(now.getTime(), cutoff.getTime()));

  // If currently on break, close open break at effective check-out time
  let breakHistory = Array.isArray(record.breakHistory) ? [...record.breakHistory] : [];
  if (record.isOnBreak && record.currentBreakStart) {
    const breakStart = new Date(record.currentBreakStart);
    const breakEnd = new Date(Math.min(now.getTime(), effectiveCheckOut.getTime()));
    const diffMs = Math.max(0, breakEnd.getTime() - breakStart.getTime());
    breakHistory.push({
      startTime: breakStart.toISOString(),
      endTime: breakEnd.toISOString(),
      durationSeconds: Math.round(diffMs / 1000),
      durationMinutes: Math.round(diffMs / 60000),
    });
  }

  const calc = calculateWorkingHoursAndOvertime({
    checkIn: record.checkIn,
    checkOut: effectiveCheckOut,
    breakHistory,
    breakDurationMinutes: record.breakDurationMinutes,
    shiftTiming,
  });

  const autoLogoutNote = '[SYSTEM_AUTO_LOGOUT] Automatically logged out 10 hours after shift completed. [NEEDS_POST_SHIFT_REMARK]';
  const updatedNotes = record.notes
    ? `${record.notes} | ${autoLogoutNote}`
    : autoLogoutNote;

  const updated = await attendanceRepository.update(record.id, {
    checkOut: effectiveCheckOut,
    totalHours: calc.totalHours,
    overtimeHours: calc.overtimeHours,
    isOnBreak: false,
    currentBreakStart: null,
    breakHistory,
    breakDurationMinutes: calc.breakDurationMinutes,
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
      if (normRole !== 'superadmin' && normRole !== 'admin' && targetEmployee.orgId !== user.orgId) {
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

    // Inactive/terminated employees cannot record attendance (Notice Period & Probation are permitted)
    const NON_WORKING_STATUSES = ['inactive', 'terminated', 'suspended', 'exited', 'archived'];
    if (targetEmployee.status && NON_WORKING_STATUSES.includes(targetEmployee.status.trim().toLowerCase())) {
      const error = new Error(`Cannot record attendance: Employee account status is "${targetEmployee.status}". Inactive or terminated employees cannot record attendance.`);
      error.statusCode = 403;
      throw error;
    }

    const todayDate = data.date || new Date().toISOString().split('T')[0];
    const serverNow = new Date();
    const shiftTiming = targetEmployee.shiftTiming || data.shiftTiming || '11:00 AM - 07:00 PM';

    // Auto-resolve any prior open records for targetEmployee exceeding cutoff or from a previous day
    try {
      const unclosed = await attendanceRepository.findActiveUnclosedRecords(targetEmployee.orgId);
      for (const rec of unclosed) {
        if (rec.employeeId === targetEmployee.id) {
          const recDateStr = typeof rec.attendanceDate === 'string' ? rec.attendanceDate.split('T')[0] : '';
          const isPriorDate = Boolean(recDateStr && recDateStr !== todayDate);
          await checkAndAutoLogoutRecord(rec, shiftTiming, isPriorDate);
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
      if (normRole !== 'superadmin' && normRole !== 'admin' && targetEmployee.orgId !== user.orgId) {
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

    // Inactive/terminated employees cannot record attendance (Notice Period & Probation are permitted)
    const NON_WORKING_STATUSES = ['inactive', 'terminated', 'suspended', 'exited', 'archived'];
    if (targetEmployee.status && NON_WORKING_STATUSES.includes(targetEmployee.status.trim().toLowerCase())) {
      const error = new Error(`Cannot record attendance: Employee account status is "${targetEmployee.status}". Inactive or terminated employees cannot record attendance.`);
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

    // Accurately compute working duration and overtime using centralized calculator
    const calculation = calculateWorkingHoursAndOvertime({
      checkIn: checkInTime,
      checkOut: serverNow,
      breakHistory,
      breakDurationMinutes: data.breakDurationMinutes,
      shiftTiming,
    });

    const totalHours = calculation.totalHours;
    const overtimeHours = calculation.overtimeHours;
    const breakMinutes = calculation.breakDurationMinutes;

    // Determine final status
    let finalStatus = 'PRESENT';
    if (totalHours < 4.0) {
      finalStatus = 'HALF_DAY';
    } else if (existing.isRegularized && ['PRESENT', 'REGULARIZED'].includes(existing.status)) {
      // Preserve HR/Manager waived on-time or regularized status
      finalStatus = existing.status;
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
    let existing = await attendanceRepository.findByEmployeeAndDate(targetEmployee.id, todayDate, targetEmployee.orgId);

    // Fallback to active unclosed record across previous dates / overnight shifts
    if (!existing || !existing.checkIn) {
      const unclosed = await attendanceRepository.findActiveUnclosedRecords(targetEmployee.orgId);
      const openRec = unclosed.find((r) => r.employeeId === targetEmployee.id);
      if (openRec) {
        existing = openRec;
      }
    }

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
    let existing = await attendanceRepository.findByEmployeeAndDate(targetEmployee.id, todayDate, targetEmployee.orgId);

    // Fallback to active unclosed record across previous dates / overnight shifts
    if (!existing || !existing.checkIn) {
      const unclosed = await attendanceRepository.findActiveUnclosedRecords(targetEmployee.orgId);
      const openRec = unclosed.find((r) => r.employeeId === targetEmployee.id);
      if (openRec) {
        existing = openRec;
      }
    }

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
    if (normRole !== 'superadmin' && normRole !== 'admin' && record.orgId !== user.orgId) {
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
   * Get organization attendance analytics (trend & distribution) for HR & Admin
   */
  async getOrgAnalytics(user, query = {}) {
    const normRole = normalizeRole(user.roleName);
    if (!['admin', 'superadmin', 'hr', 'hrmanager', 'orgadmin'].includes(normRole)) {
      const error = new Error('Access denied: Requires HR or Admin authorization.');
      error.statusCode = 403;
      throw error;
    }

    // Automatically resolve stale sessions across organization
    await autoCheckoutStaleRecords(user.orgId);

    return attendanceRepository.getAttendanceAnalytics(user.orgId, query);
  },

  /**
   * Get organization-wide attendance for HR & Admin
   */
  async getOrgAttendance(user, query = {}) {
    const normRole = normalizeRole(user.roleName);
    if (!['admin', 'superadmin', 'hr', 'hrmanager', 'orgadmin'].includes(normRole)) {
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
    if (normRole !== 'superadmin' && normRole !== 'admin' && record.orgId !== user.orgId) {
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

    const shiftTiming = record.employee?.shiftTiming || '11:00 AM - 07:00 PM';
    const tz = record.timezone || 'Asia/Kolkata';

    // Compute updated hours if check-in or check-out adjusted
    const newCheckIn = data.checkIn ? new Date(data.checkIn) : record.checkIn ? new Date(record.checkIn) : null;
    const newCheckOut = data.checkOut ? new Date(data.checkOut) : record.checkOut ? new Date(record.checkOut) : null;

    let totalHours = record.totalHours;
    let overtimeHours = record.overtimeHours;
    let breakDurationMinutes = record.breakDurationMinutes || 0;

    if (newCheckIn && newCheckOut) {
      if (newCheckOut.getTime() < newCheckIn.getTime()) {
        const error = new Error('Check-out timestamp cannot be earlier than check-in timestamp.');
        error.statusCode = 400;
        throw error;
      }
      const calc = calculateWorkingHoursAndOvertime({
        checkIn: newCheckIn,
        checkOut: newCheckOut,
        breakHistory: record.breakHistory || [],
        breakDurationMinutes: data.breakDurationMinutes !== undefined ? data.breakDurationMinutes : record.breakDurationMinutes,
        shiftTiming,
      });
      totalHours = calc.totalHours;
      overtimeHours = calc.overtimeHours;
      breakDurationMinutes = calc.breakDurationMinutes;
    }

    // Wisely determine final attendance status
    let finalStatus = data.status && data.status.trim().toUpperCase() !== 'AUTO' ? data.status.trim().toUpperCase() : null;

    if (!finalStatus) {
      if (newCheckIn) {
        // Intelligently evaluate whether arrival is on-time with 10-minute grace window
        const evaluatedStatus = determineAttendanceStatus(newCheckIn, shiftTiming, tz, 10);
        if (evaluatedStatus === 'PRESENT') {
          // If check-in is within shift start + grace window, wisely set to PRESENT
          finalStatus = 'PRESENT';
        } else {
          finalStatus = (totalHours > 0 && totalHours < 4.0) ? 'HALF_DAY' : 'LATE';
        }
      } else {
        finalStatus = record.status || 'REGULARIZED';
      }
    }

    // Build transparent audit remarks with text message
    const userDisplayName = user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (user.email || 'HR/Manager');
    const roleLabel = normRole === 'manager' ? 'Manager' : (['hr', 'hrmanager'].includes(normRole) ? 'HR' : 'Admin');
    const reasonText = (data.regularizationReason || '').trim();
    const auditNote = `[TIMING_ADJUSTED by ${roleLabel} (${userDisplayName}): ${reasonText}]`;
    const combinedNotes = data.notes
      ? (record.notes ? `${record.notes} | ${data.notes} | ${auditNote}` : `${data.notes} | ${auditNote}`)
      : (record.notes ? `${record.notes} | ${auditNote}` : auditNote);

    return attendanceRepository.update(id, {
      checkIn: newCheckIn,
      checkOut: newCheckOut,
      totalHours,
      overtimeHours,
      breakDurationMinutes,
      status: finalStatus,
      isRegularized: true,
      regularizationReason: reasonText,
      regularizedBy: user.id,
      regularizedAt: new Date(),
      notes: combinedNotes,
    });
  },

  /**
   * Add a Shift Remark (OT, Mistake, or Emergency) on an attendance session
   * Classifies sessions (including those logged out after 10h post-shift or with excess hours)
   */
  async addShiftRemark(user, id, { remarkType, comments }) {
    const record = await attendanceRepository.findById(id);
    if (!record) {
      const error = new Error('Attendance record not found.');
      error.statusCode = 404;
      throw error;
    }

    const normRole = normalizeRole(user.roleName);
    const allowedRoles = ['admin', 'hr', 'manager', 'superadmin', 'hrmanager', 'orgadmin', 'employee'];
    if (!allowedRoles.includes(normRole)) {
      const error = new Error('Access denied: Unauthorized role to submit shift remarks.');
      error.statusCode = 403;
      throw error;
    }

    // Organization boundary check
    if (normRole !== 'superadmin' && normRole !== 'admin' && record.orgId !== user.orgId) {
      const error = new Error('Access denied: Attendance record belongs to a different organization.');
      error.statusCode = 403;
      throw error;
    }

    // Employee boundary check: can tag their own record
    if (normRole === 'employee') {
      const emp = await resolveRequesterEmployee(user);
      if (!emp || emp.id !== record.employeeId) {
        const error = new Error('Access denied: Employees can only tag their own attendance records.');
        error.statusCode = 403;
        throw error;
      }
    }

    // Manager boundary check: can remark only department members or own record
    if (normRole === 'manager') {
      const managerEmp = await resolveRequesterEmployee(user);
      const isOwnRecord = managerEmp && managerEmp.id === record.employeeId;
      const isDeptMember = managerEmp && managerEmp.deptId && record.employee && record.employee.deptId === managerEmp.deptId;
      if (!isOwnRecord && !isDeptMember) {
        const error = new Error('Access denied: Managers can only add remarks for members in their department or their own records.');
        error.statusCode = 403;
        throw error;
      }
    }

    const typeNormalized = (remarkType || '').trim().toUpperCase();
    if (!['EMERGENCY', 'OT', 'MISTAKE'].includes(typeNormalized)) {
      const error = new Error("Invalid remark type. Must be 'OT', 'MISTAKE', or 'EMERGENCY'.");
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

    // Adjust hours and checkout if marked as MISTAKE (forgot to logout / spurious duration)
    let updatedTotalHours = record.totalHours;
    let updatedOvertimeHours = record.overtimeHours;
    let updatedCheckOut = record.checkOut;

    if (typeNormalized === 'MISTAKE') {
      // Overtime is voided
      updatedOvertimeHours = 0.00;
      // Cap working duration to standard shift duration
      const shiftTiming = record.employee?.shiftTiming || '11:00 AM - 07:00 PM';
      const shiftInfo = parseShiftTiming(shiftTiming);
      const scheduledHours = shiftInfo.scheduledDurationHours || 8.0;
      updatedTotalHours = scheduledHours;

      // Adjust checkOut timestamp to match scheduled shift completion if checkIn exists
      if (record.checkIn) {
        const inTime = new Date(record.checkIn).getTime();
        const breakMs = (record.breakDurationMinutes || 0) * 60 * 1000;
        const netShiftMs = scheduledHours * 3600 * 1000;
        updatedCheckOut = new Date(inTime + netShiftMs + breakMs);
      }
    }

    const updatedRecord = await attendanceRepository.update(id, {
      checkOut: updatedCheckOut,
      totalHours: updatedTotalHours,
      overtimeHours: updatedOvertimeHours,
      isRegularized: true,
      regularizationReason,
      regularizedBy: user.id,
      regularizedAt: new Date(),
      notes: updatedNotes,
    });

    return updatedRecord;
  },
};

