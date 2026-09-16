import { http } from './api.js';

export const leaveService = {
  /**
   * Fetch available leave types for current organization
   */
  async getLeaveTypes() {
    const res = await http.get('/v1/leaves/types');
    return res.data || [];
  },

  /**
   * Fetch authenticated employee's leave balances
   * @param {number} year - Optional calendar year (defaults to current year)
   */
  async getMyBalances(year) {
    const query = year ? `?year=${year}` : '';
    const res = await http.get(`/v1/leaves/balances${query}`);
    return res.data || [];
  },

  /**
   * Calculate leave duration with working days, weekends, and holidays
   * @param {Object} payload - { startDate, endDate, isHalfDay, halfDayPeriod }
   */
  async calculateDuration(payload) {
    const res = await http.post('/v1/leaves/calculate', payload);
    return res.data || null;
  },

  /**
   * Apply for leave (Employee)
   * @param {Object} payload - { leaveTypeId, startDate, endDate, isHalfDay, halfDayPeriod, reason }
   */
  async applyLeave(payload) {
    const res = await http.post('/v1/leaves/apply', payload);
    return res.data;
  },

  /**
   * Fetch employee's own leave requests
   * @param {Object} params - { status, page, limit }
   */
  async getMyLeaves(params = {}) {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    const queryString = query.toString() ? `?${query.toString()}` : '';

    const res = await http.get(`/v1/leaves/my${queryString}`);
    return {
      records: res.data || [],
      pagination: res.meta?.pagination || null,
    };
  },

  /**
   * Fetch team leave requests (Manager scope)
   * @param {Object} params - { status, page, limit }
   */
  async getTeamLeaves(params = {}) {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    const queryString = query.toString() ? `?${query.toString()}` : '';

    const res = await http.get(`/v1/leaves/team${queryString}`);
    return {
      records: res.data || [],
      pagination: res.meta?.pagination || null,
    };
  },

  /**
   * Fetch organization leave requests (HR / Admin scope)
   * @param {Object} params - { status, search, deptId, page, limit }
   */
  async getOrgLeaves(params = {}) {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.search) query.append('search', params.search);
    if (params.deptId) query.append('deptId', params.deptId);
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    const queryString = query.toString() ? `?${query.toString()}` : '';

    const res = await http.get(`/v1/leaves/organization${queryString}`);
    return {
      records: res.data || [],
      pagination: res.meta?.pagination || null,
    };
  },

  /**
   * Fetch single leave request details
   * @param {string} id
   */
  async getLeaveById(id) {
    const res = await http.get(`/v1/leaves/${id}`);
    return res.data;
  },

  /**
   * Cancel own pending leave request
   * @param {string} id
   * @param {Object} payload - { cancellationReason }
   */
  async cancelLeave(id, payload = {}) {
    const res = await http.post(`/v1/leaves/${id}/cancel`, payload);
    return res.data;
  },

  /**
   * Approve leave request (Manager / HR / Admin)
   * @param {string} id
   * @param {Object} payload - { comments }
   */
  async approveLeave(id, payload = {}) {
    const res = await http.post(`/v1/leaves/${id}/approve`, payload);
    return res.data;
  },

  /**
   * Reject leave request (Manager / HR / Admin)
   * @param {string} id
   * @param {Object} payload - { rejectionReason }
   */
  async rejectLeave(id, payload) {
    const res = await http.post(`/v1/leaves/${id}/reject`, payload);
    return res.data;
  },
};
