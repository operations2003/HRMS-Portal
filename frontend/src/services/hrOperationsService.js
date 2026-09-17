import { http } from './api.js';

export const hrOperationsService = {
  /**
   * Get consolidated workforce and operational overview
   */
  async getOverview() {
    const res = await http.get('/v1/hr/operations/overview');
    return res.data;
  },

  /**
   * Get cross-module pending approval queue (leaves, performance, helpdesk)
   */
  async getApprovalQueue() {
    const res = await http.get('/v1/hr/operations/approval-queue');
    return res.data;
  },

  /**
   * Broadcast announcement / alert to workforce
   * @param {Object} data { title, message, priority }
   */
  async broadcastAnnouncement(data) {
    const res = await http.post('/v1/hr/operations/broadcast', data);
    return res.data;
  },

  /**
   * Get operational breakdown of all teams and managers
   */
  async getTeams() {
    const res = await http.get('/v1/hr/operations/teams');
    return res.data;
  },

  /**
   * Get detailed team metrics for a specific manager
   * @param {string} managerId 
   */
  async getTeamByManager(managerId) {
    const res = await http.get(`/v1/hr/operations/teams/${managerId}`);
    return res.data;
  },

  /**
   * Get organization-wide performance cycle summary
   */
  async getPerformanceSummary() {
    const res = await http.get('/v1/hr/operations/performance/summary');
    return res.data;
  },

  /**
   * Get organization-wide daily attendance summary
   * @param {Object} params { date }
   */
  async getAttendanceSummary(params = {}) {
    const query = new URLSearchParams();
    if (params.date) query.append('date', params.date);
    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await http.get(`/v1/hr/operations/attendance/summary${qs}`);
    return res.data;
  },

  /**
   * Get organization-wide leave utilization and pending summary
   */
  async getLeaveSummary() {
    const res = await http.get('/v1/hr/operations/leaves/summary');
    return res.data;
  },

  /**
   * Get 360-degree operational profile/dossier for an employee
   * @param {string} employeeId 
   */
  async getEmployeeProfile(employeeId) {
    const res = await http.get(`/v1/hr/operations/employees/${employeeId}`);
    return res.data;
  }
};
