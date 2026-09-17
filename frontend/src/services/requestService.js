import { http } from './api.js';

export const requestService = {
  /**
   * Get employee's own requests
   */
  async getMyRequests(params = {}) {
    const res = await http.get('/v1/requests/my', { params });
    return res.data;
  },

  /**
   * List all requests (HR / Admin)
   */
  async listRequests(params = {}) {
    const res = await http.get('/v1/requests', { params });
    return res.data;
  },

  /**
   * Get request details with updates thread
   */
  async getRequestById(id) {
    const res = await http.get(`/v1/requests/${id}`);
    return res.data;
  },

  /**
   * Create a new employee service request
   */
  async createRequest(data) {
    const res = await http.post('/v1/requests', data);
    return res.data;
  },

  /**
   * Add message/clarification update to a request
   */
  async addUpdate(id, data) {
    const res = await http.post(`/v1/requests/${id}/updates`, data);
    return res.data;
  },

  /**
   * Cancel an open request (by employee or HR)
   */
  async cancelRequest(id) {
    const res = await http.post(`/v1/requests/${id}/cancel`);
    return res.data;
  },

  /**
   * Assign request to staff or team (HR/Admin)
   */
  async assignRequest(id, data) {
    const res = await http.post(`/v1/requests/${id}/assign`, data);
    return res.data;
  },

  /**
   * Update request status (HR/Admin)
   */
  async updateStatus(id, status) {
    const res = await http.patch(`/v1/requests/${id}/status`, { status });
    return res.data;
  },

  /**
   * Resolve request with response notes (HR/Admin)
   */
  async resolveRequest(id, data) {
    const res = await http.post(`/v1/requests/${id}/resolve`, data);
    return res.data;
  },

  /**
   * Reject request with reason (HR/Admin)
   */
  async rejectRequest(id, data) {
    const res = await http.post(`/v1/requests/${id}/reject`, data);
    return res.data;
  },

  /**
   * Get overview statistics
   */
  async getStats() {
    const res = await http.get('/v1/requests/stats');
    return res.data;
  },
};

export default requestService;
