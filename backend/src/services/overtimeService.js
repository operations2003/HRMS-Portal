import { overtimeRepository } from '../repositories/overtimeRepository.js';
import { attendanceRepository } from '../repositories/attendanceRepository.js';
import {
  calculateAutoLogoutCutoff,
  checkAndAutoLogoutRecord,
  resolveRequesterEmployee,
} from './attendanceService.js';
import { isCeoOrAdmin } from '../utils/roleUtils.js';

export const overtimeService = {
  /**
   * Get employee's today overtime state
   */
  async getTodayOvertime(user) {
    const employee = await resolveRequesterEmployee(user);
    if (!employee && !isCeoOrAdmin(user)) {
      const error = new Error('No employee profile found for your user account.');
      error.statusCode = 404;
      throw error;
    }

    // CEO / Administrator account is exempt from attendance logging
    if (isCeoOrAdmin(user) || (employee && isCeoOrAdmin(employee))) {
      return {
        status: 'EXEMPT',
        isExempt: true,
        canLogin: false,
        canLogout: false,
        message: 'Administrator / CEO supervises the system and is exempt from daily attendance logging.',
        currentRecord: null,
        todayRecords: [],
        regularAttendanceCompleted: true,
      };
    }

    const tz = employee.timezone || 'Asia/Kolkata';
    const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: tz });

    // Step 1: Ensure any open regular attendance records past shift cutoff are auto-logged out
    try {
      const unclosedList = await attendanceRepository.findActiveUnclosedRecords(employee.orgId);
      for (const rec of unclosedList) {
        if (rec.employeeId === employee.id) {
          await checkAndAutoLogoutRecord(rec, employee.shiftTiming);
        }
      }
    } catch {
      // Non-blocking
    }

    // Step 2: Fetch today's regular attendance record
    const regularRecord = await attendanceRepository.findByEmployeeAndDate(employee.id, todayDate, employee.orgId);
    const regularAttendanceCompleted = Boolean(regularRecord && regularRecord.checkIn && regularRecord.checkOut);

    // Step 3: Fetch active overtime session or today's overtime records
    const activeOvertime = await overtimeRepository.findActiveByEmployee(employee.id, employee.orgId);
    const todayRecords = await overtimeRepository.findByEmployeeAndDate(employee.id, todayDate, employee.orgId);

    let status = 'NOT_STARTED';
    let canLogin = false;
    let canLogout = false;
    let currentRecord = null;

    if (activeOvertime) {
      status = 'IN_PROGRESS';
      canLogin = false;
      canLogout = true;
      currentRecord = activeOvertime;
    } else if (todayRecords && todayRecords.length > 0) {
      currentRecord = todayRecords[0];
      status = currentRecord.status || 'COMPLETED';
      canLogin = false;
      canLogout = false;
    } else {
      status = 'NOT_STARTED';
      // Overtime can only be started if regular attendance has ended
      canLogin = regularAttendanceCompleted;
      canLogout = false;
    }

    return {
      status,
      canLogin,
      canLogout,
      regularAttendanceCompleted,
      regularRecord: regularRecord ? {
        id: regularRecord.id,
        checkIn: regularRecord.checkIn,
        checkOut: regularRecord.checkOut,
        status: regularRecord.status,
      } : null,
      currentRecord,
      todayRecords: todayRecords || [],
      shiftTiming: employee.shiftTiming || '11:00 AM - 07:00 PM',
    };
  },

  /**
   * Start an Overtime session
   */
  async loginOvertime(user, data = {}, clientIp = '') {
    const employee = await resolveRequesterEmployee(user);
    if (!employee) {
      const error = new Error('No employee profile found for your user account.');
      error.statusCode = 404;
      throw error;
    }

    if (isCeoOrAdmin(user) || isCeoOrAdmin(employee)) {
      const error = new Error('Overtime logging is not applicable for the Administrator / CEO.');
      error.statusCode = 403;
      throw error;
    }

    const NON_WORKING_STATUSES = ['inactive', 'terminated', 'suspended', 'exited', 'archived'];
    if (employee.status && NON_WORKING_STATUSES.includes(employee.status.trim().toLowerCase())) {
      const error = new Error(`Cannot record overtime: Employee account status is "${employee.status}". Inactive or terminated employees cannot log in.`);
      error.statusCode = 403;
      throw error;
    }

    const tz = employee.timezone || 'Asia/Kolkata';
    const todayDate = data.date || new Date().toLocaleDateString('en-CA', { timeZone: tz });

    // Step 1: Check if an active overtime session is already in progress
    const activeSession = await overtimeRepository.findActiveByEmployee(employee.id, employee.orgId);
    if (activeSession) {
      const error = new Error('An overtime session is already in progress. Please log out of the current overtime session first.');
      error.statusCode = 409;
      throw error;
    }

    // Step 2: Auto-resolve any open regular attendance if past 20-min grace cutoff
    let regularRecord = await attendanceRepository.findByEmployeeAndDate(employee.id, todayDate, employee.orgId);
    if (!regularRecord || !regularRecord.checkIn) {
      // Check if unclosed from earlier/overnight
      const unclosedList = await attendanceRepository.findActiveUnclosedRecords(employee.orgId);
      const openRec = unclosedList.find((r) => r.employeeId === employee.id);
      if (openRec) {
        regularRecord = await checkAndAutoLogoutRecord(openRec, employee.shiftTiming);
      }
    } else if (!regularRecord.checkOut) {
      const cutoff = calculateAutoLogoutCutoff(regularRecord, employee.shiftTiming, employee.timezone, 20);
      if (cutoff && new Date().getTime() >= cutoff.getTime()) {
        regularRecord = await checkAndAutoLogoutRecord(regularRecord, employee.shiftTiming);
      }
    }

    // Step 3: Validate regular attendance session has ended
    if (!regularRecord || !regularRecord.checkIn) {
      const error = new Error('Overtime login is only permitted after completing your regular shift attendance for today. Please check in and complete your regular shift first.');
      error.statusCode = 400;
      throw error;
    }

    if (!regularRecord.checkOut) {
      const error = new Error('Overtime login is only permitted after your regular attendance session has ended. Your regular shift is still active; please check out from regular attendance first.');
      error.statusCode = 400;
      throw error;
    }

    // Step 4: Create new overtime session
    const now = new Date();
    const created = await overtimeRepository.create({
      orgId: employee.orgId,
      employeeId: employee.id,
      attendanceRecordId: regularRecord.id,
      overtimeDate: todayDate,
      startTime: now,
      status: 'IN_PROGRESS',
      notes: data.notes || '',
      source: data.source || 'WEB',
      ipAddress: clientIp || '',
    });

    return created;
  },

  /**
   * End an Overtime session
   */
  async logoutOvertime(user, data = {}) {
    const employee = await resolveRequesterEmployee(user);
    if (!employee) {
      const error = new Error('No employee profile found for your user account.');
      error.statusCode = 404;
      throw error;
    }

    if (isCeoOrAdmin(user) || isCeoOrAdmin(employee)) {
      const error = new Error('Overtime logging is not applicable for the Administrator / CEO.');
      error.statusCode = 403;
      throw error;
    }

    const activeSession = await overtimeRepository.findActiveByEmployee(employee.id, employee.orgId);
    if (!activeSession) {
      const error = new Error('Cannot log out of overtime: No active overtime session found.');
      error.statusCode = 400;
      throw error;
    }

    const now = new Date();
    const startTime = new Date(activeSession.startTime);
    const diffMs = Math.max(0, now.getTime() - startTime.getTime());
    const durationSeconds = Math.floor(diffMs / 1000);
    const durationMinutes = Math.floor(diffMs / 60000);
    const durationHours = parseFloat((durationSeconds / 3600).toFixed(2));

    const updatedNotes = data.notes
      ? (activeSession.notes ? `${activeSession.notes} | ${data.notes}` : data.notes)
      : activeSession.notes;

    const updated = await overtimeRepository.update(activeSession.id, {
      endTime: now,
      durationHours,
      durationMinutes,
      status: 'COMPLETED',
      notes: updatedNotes,
    });

    return updated;
  },

  /**
   * Get employee overtime history
   */
  async getOvertimeHistory(user, query = {}) {
    const employee = await resolveRequesterEmployee(user);
    if (!employee && !isCeoOrAdmin(user)) {
      const error = new Error('No employee profile found for your user account.');
      error.statusCode = 404;
      throw error;
    }

    if (isCeoOrAdmin(user) || (employee && isCeoOrAdmin(employee))) {
      return {
        records: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      };
    }

    return overtimeRepository.findHistoryByEmployee(employee.id, employee.orgId, query);
  },
};

