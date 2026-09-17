import { http } from './api.js';

export const performanceService = {
  async getPeriods() {
    const res = await http.get('/v1/performance/periods');
    return res.data;
  },

  async createPeriod(data) {
    const res = await http.post('/v1/performance/periods', data);
    return res.data;
  },

  async getMyPerformance() {
    const res = await http.get('/v1/performance/my');
    return res.data;
  },

  async getTeamPerformance(params = {}) {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.periodId) query.append('periodId', params.periodId);
    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await http.get(`/v1/performance/team${qs}`);
    return res.data;
  },

  async getOrganizationRecords(params = {}) {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.periodId) query.append('periodId', params.periodId);
    if (params.search) query.append('search', params.search);
    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await http.get(`/v1/performance/records${qs}`);
    return res.data;
  },

  async getRecordById(id) {
    const res = await http.get(`/v1/performance/records/${id}`);
    return res.data;
  },

  async createRecord(data) {
    const res = await http.post('/v1/performance/records', data);
    return res.data;
  },

  async updateRecord(id, data) {
    const res = await http.put(`/v1/performance/records/${id}`, data);
    return res.data;
  },

  async addGoal(recordId, goalData) {
    const res = await http.post(`/v1/performance/records/${recordId}/goals`, goalData);
    return res.data;
  },

  async updateGoal(recordId, goalId, goalData) {
    const res = await http.put(`/v1/performance/records/${recordId}/goals/${goalId}`, goalData);
    return res.data;
  },

  async deleteGoal(recordId, goalId) {
    const res = await http.delete(`/v1/performance/records/${recordId}/goals/${goalId}`);
    return res.data;
  },

  async submitRecord(id) {
    const res = await http.post(`/v1/performance/records/${id}/submit`, {});
    return res.data;
  },

  async managerReview(id, data) {
    const res = await http.post(`/v1/performance/records/${id}/manager-review`, data);
    return res.data;
  },

  async returnRecord(id, data) {
    const res = await http.post(`/v1/performance/records/${id}/return`, data);
    return res.data;
  },

  async hrApprove(id, data) {
    const res = await http.post(`/v1/performance/records/${id}/hr-approve`, data);
    return res.data;
  },

  async rejectRecord(id, data) {
    const res = await http.post(`/v1/performance/records/${id}/reject`, data);
    return res.data;
  },
};

export default performanceService;
