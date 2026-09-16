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

    // Determine initial status (check if marked late based on standard shift or default 09:30 AM)
    let status = 'PRESENT';
    const hours = serverNow.getHours();
    const minutes = serverNow.getMinutes();
    if (hours > 9 || (hours === 9 && minutes > 30)) {
      status = 'LATE';
    }

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

    // Calculate total hours worked
    const breakMinutes = data.breakDurationMinutes !== undefined ? parseInt(data.breakDurationMinutes, 10) : existing.breakDurationMinutes || 0;
    const durationMs = serverNow.getTime() - checkInTime.getTime();
    const grossHours = durationMs / (1000 * 60 * 60);
    const netHours = Math.max(0, grossHours - breakMinutes / 60);
    const totalHours = parseFloat(netHours.toFixed(2));

    // Calculate overtime if applicable (> 8 hours standard work day)
    const overtimeHours = totalHours > 8.0 ? parseFloat((totalHours - 8.0).toFixed(2)) : 0.0;

    // Determine final status
    let finalStatus = existing.status;
    if (totalHours < 4.0) {
      finalStatus = 'HALF_DAY';
    } else if (existing.status === 'LATE') {
      finalStatus = 'LATE';
    } else {
      finalStatus = 'PRESENT';
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
      breakDurationMinutes: breakMinutes,
      overtimeHours,
      notes: updatedNotes,
      location: data.location || existing.location,
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

    return attendanceRepository.findByEmployeeHistory(employee.id, employee.orgId, query);
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
