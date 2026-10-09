import { http } from './api.js';

export const attendanceService = {
  /**
   * Record Check-In punch
   * @param {Object} data - { timezone, source, location, notes, employeeId }
   */
  async checkIn(data = {}) {
    const res = await http.post('/v1/attendance/check-in', data);
    return res.data;
  },

  /**
   * Record Logout (Check-Out) punch
   * @param {Object} data - { breakDurationMinutes, notes, location, employeeId }
   */
  async checkOut(data = {}) {
    const res = await http.post('/v1/attendance/check-out', data);
    return res.data;
  },

  /**
   * Pause shift for break
   */
  async pauseBreak() {
    const res = await http.post('/v1/attendance/pause-break', {});
    return res.data;
  },

  /**
   * Resume shift after break
   */
  async resumeBreak() {
    const res = await http.post('/v1/attendance/resume-break', {});
    return res.data;
  },

  /**
   * Get authenticated employee's today record and profile
   */
  async getMyTodayRecord() {
    const res = await http.get('/v1/attendance/my/today');
    return {
      todayRecord: res.data || null,
      employeeProfile: res.meta?.employeeProfile || null,
    };
  },

  /**
   * Get authenticated user's own attendance history with stats
   * @param {Object} params - { startDate, endDate, status, page, limit }
   */
  async getMyAttendance(params = {}) {
    const query = new URLSearchParams();
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    if (params.status) query.append('status', params.status);
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    if (params.includeLeaves !== undefined) query.append('includeLeaves', params.includeLeaves);
    const queryString = query.toString() ? `?${query.toString()}` : '';

    const res = await http.get(`/v1/attendance/my${queryString}`);
    return {
      records: res.data || [],
      statistics: res.meta?.statistics || {},
      pagination: res.meta?.pagination || {},
      employeeProfile: res.meta?.employeeProfile || null,
      todayRecord: res.meta?.todayRecord || null,
    };
  },

  /**
   * Get team attendance for Manager (scoped to department)
   * @param {Object} params - { startDate, endDate, deptId, status, page, limit }
   */
  async getTeamAttendance(params = {}) {
    const query = new URLSearchParams();
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    if (params.deptId) query.append('deptId', params.deptId);
    if (params.status) query.append('status', params.status);
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    if (params.includeLeaves !== undefined) query.append('includeLeaves', params.includeLeaves);
    const queryString = query.toString() ? `?${query.toString()}` : '';

    const res = await http.get(`/v1/attendance/team${queryString}`);
    return {
      records: res.data || [],
      pagination: res.meta?.pagination || {},
    };
  },

  /**
   * Get organization-wide attendance & daily summary for HR / Admin
   * @param {Object} params - { date, startDate, endDate, status, deptId, search, page, limit }
   */
  async getOrgAttendance(params = {}) {
    const query = new URLSearchParams();
    if (params.date) query.append('date', params.date);
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    if (params.status) query.append('status', params.status);
    if (params.deptId) query.append('deptId', params.deptId);
    if (params.search) query.append('search', params.search);
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    if (params.includeLeaves !== undefined) query.append('includeLeaves', params.includeLeaves);
    const queryString = query.toString() ? `?${query.toString()}` : '';

    const res = await http.get(`/v1/attendance/organization${queryString}`);
    return {
      records: res.data || [],
      summary: res.meta?.summary || {},
      pagination: res.meta?.pagination || {},
    };
  },

  /**
   * Get organization attendance analytics (trend, distribution, KPI metrics) for HR / Admin
   * @param {Object} params - { view, shift, deptId, date }
   */
  async getOrgAnalytics(params = {}) {
    const query = new URLSearchParams();
    if (params.view) query.append('view', params.view);
    if (params.shift) query.append('shift', params.shift);
    if (params.deptId) query.append('deptId', params.deptId);
    if (params.date) query.append('date', params.date);
    const queryString = query.toString() ? `?${query.toString()}` : '';

    const res = await http.get(`/v1/attendance/organization/analytics${queryString}`);
    return res.data;
  },

  /**
   * Get attendance record by ID
   * @param {string} id
   */
  async getAttendanceById(id) {
    const res = await http.get(`/v1/attendance/${id}`);
    return res.data;
  },

  /**
   * Regularize attendance record (Manager, HR, Admin)
   * @param {string} id
   * @param {Object} data - { checkIn, checkOut, status, regularizationReason, notes }
   */
  async regularize(id, data) {
    const res = await http.put(`/v1/attendance/${id}/regularize`, data);
    return res.data;
  },

  /**
   * Add Emergency or OT remark on attendance record (Manager, HR, Admin)
   * @param {string} id
   * @param {Object} data - { remarkType: 'EMERGENCY' | 'OT', comments: string }
   */
  async addShiftRemark(id, data) {
    const res = await http.put(`/v1/attendance/${id}/remark`, data);
    return res.data;
  },

  /**
   * Fetch leave options & bucket balances for converting an absent attendance record
   * @param {string} id
   */
  async getAbsentLeaveOptions(id) {
    const res = await http.get(`/v1/attendance/${id}/absent-leave-options`);
    return res.data;
  },

  /**
   * Convert an ABSENT attendance record to an approved leave and deduct from bucket
   * @param {string} id
   * @param {Object} data - { leaveTypeId: string, reason?: string }
   */
  async convertAbsenceToLeave(id, data) {
    const res = await http.post(`/v1/attendance/${id}/convert-to-leave`, data);
    return res.data;
  },

  /**
   * Synchronize daily absences (mark employees who didn't log in as ABSENT)
   * @param {Object} data - { date?: string }
   */
  async syncDailyAbsences(data = {}) {
    const res = await http.post('/v1/attendance/sync-absences', data);
    return res.data;
  },

  /**
   * Get employee's today overtime status and active record
   */
  async getTodayOvertime() {
    const res = await http.get('/v1/attendance/overtime/today');
    return res.data;
  },

  /**
   * Start an Overtime session
   * @param {Object} data - { notes?: string }
   */
  async loginOvertime(data = {}) {
    const res = await http.post('/v1/attendance/overtime/login', data);
    return res.data;
  },

  /**
   * End an Overtime session
   * @param {Object} data - { notes?: string }
   */
  async logoutOvertime(data = {}) {
    const res = await http.post('/v1/attendance/overtime/logout', data);
    return res.data;
  },

  /**
   * Get employee's overtime history
   * @param {Object} params - { page, limit, startDate, endDate }
   */
  async getOvertimeHistory(params = {}) {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    const queryString = query.toString();
    const url = `/v1/attendance/overtime/history${queryString ? `?${queryString}` : ''}`;
    const res = await http.get(url);
    return res.data;
  },
};

