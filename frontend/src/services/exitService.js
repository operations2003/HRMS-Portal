import { http } from './api.js';

export const exitService = {
  /**
   * Submit resignation (Employee self-service)
   */
  async submitResignation(data) {
    const res = await http.post('/v1/exit/resign', data);
    return res.data;
  },

  /**
   * Withdraw pending resignation
   */
  async withdrawResignation(id, reason) {
    const res = await http.post(`/v1/exit/requests/${id}/withdraw`, { reason });
    return res.data;
  },

  /**
   * Get logged-in employee's active exit request and dossier
   */
  async getMyExit() {
    const res = await http.get('/v1/exit/my');
    return res.data;
  },

  /**
   * Get team exits pending manager review
   */
  async getTeamExits(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const queryString = query.toString() ? `?${query.toString()}` : '';
    const res = await http.get(`/v1/exit/team${queryString}`);
    return res.data;
  },

  /**
   * Manager evaluation of resignation
   */
  async managerReview(id, data) {
    const res = await http.post(`/v1/exit/requests/${id}/manager-review`, data);
    return res.data;
  },

  /**
   * Get HR/Admin analytics summary
   */
  async getAdminStats() {
    const res = await http.get('/v1/exit/admin/stats');
    return res.data;
  },

  /**
   * Get all organization exit records (HR & Admin)
   */
  async getAllExits(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const queryString = query.toString() ? `?${query.toString()}` : '';
    const res = await http.get(`/v1/exit/requests${queryString}`);
    return {
      items: res.data || [],
      pagination: res.meta || { total: res.data?.length || 0, page: 1, limit: 20 },
    };
  },

  /**
   * Get comprehensive exit dossier by ID
   */
  async getExitById(id) {
    const res = await http.get(`/v1/exit/requests/${id}`);
    return res.data;
  },

  /**
   * HR approval & notice period confirmation
   */
  async hrApprove(id, data) {
    const res = await http.post(`/v1/exit/requests/${id}/hr-approve`, data);
    return res.data;
  },

  /**
   * HR rejection of resignation
   */
  async hrReject(id, data) {
    const res = await http.post(`/v1/exit/requests/${id}/hr-reject`, data);
    return res.data;
  },

  /**
   * Get departmental clearances checklist
   */
  async getClearances(id) {
    const res = await http.get(`/v1/exit/requests/${id}/clearances`);
    return res.data;
  },

  /**
   * Add custom clearance task
   */
  async createClearanceTask(id, data) {
    const res = await http.post(`/v1/exit/requests/${id}/clearances`, data);
    return res.data;
  },

  /**
   * Update clearance task status & recovery
   */
  async updateClearanceTask(taskId, data) {
    const res = await http.patch(`/v1/exit/clearances/${taskId}`, data);
    return res.data;
  },

  /**
   * Get offboarding status and milestones
   */
  async getOffboarding(id) {
    const res = await http.get(`/v1/exit/requests/${id}/offboarding`);
    return res.data;
  },

  /**
   * Update offboarding milestones
   */
  async updateOffboarding(id, data) {
    const res = await http.patch(`/v1/exit/requests/${id}/offboarding`, data);
    return res.data;
  },

  /**
   * Revoke system access and reassign direct reports
   */
  async removeAccess(id, data) {
    const res = await http.post(`/v1/exit/requests/${id}/access-removal`, data);
    return res.data;
  },

  /**
   * Get Full & Final (FnF) settlement details
   */
  async getFnf(id) {
    const res = await http.get(`/v1/exit/requests/${id}/fnf`);
    return res.data;
  },

  /**
   * Calculate FnF settlement
   */
  async calculateFnf(id, data = {}) {
    const res = await http.post(`/v1/exit/requests/${id}/fnf`, data);
    return res.data;
  },

  /**
   * Approve FnF settlement
   */
  async approveFnf(id, data = {}) {
    const res = await http.post(`/v1/exit/requests/${id}/fnf/approve`, data);
    return res.data;
  },

  /**
   * Disburse FnF settlement payment
   */
  async disburseFnf(id, data) {
    const res = await http.post(`/v1/exit/requests/${id}/fnf/disburse`, data);
    return res.data;
  },

  /**
   * Finalize and complete entire exit process
   */
  async completeExit(id, data = {}) {
    const res = await http.post(`/v1/exit/requests/${id}/complete`, data);
    return res.data;
  },

  /**
   * Unified deprovision access
   */
  async deprovisionAccess(id, data = {}) {
    const res = await http.post(`/v1/exit/requests/${id}/deprovision`, data);
    return res.data;
  },
};
