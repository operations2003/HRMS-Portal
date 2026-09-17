import { http } from './api.js';

export const performanceService = {
  async getPeriods(params = {}) {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.periodType) query.append('periodType', params.periodType);
    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await http.get(`/v1/performance/periods${qs}`);
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

  async updateGoal(arg1, arg2, arg3) {
    // Supports updateGoal(goalId, goalData) or updateGoal(recordId, goalId, goalData)
    const goalId = arg3 !== undefined ? arg2 : arg1;
    const goalData = arg3 !== undefined ? arg3 : arg2;
    const res = await http.put(`/v1/performance/goals/${goalId}`, goalData);
    return res.data;
  },

  async deleteGoal(arg1, arg2) {
    // Supports deleteGoal(goalId) or deleteGoal(recordId, goalId)
    const goalId = arg2 !== undefined ? arg2 : arg1;
    const res = await http.delete(`/v1/performance/goals/${goalId}`);
    return res.data;
  },

  async submitRecord(id, data = {}) {
    const res = await http.post(`/v1/performance/records/${id}/submit`, data);
    return res.data;
  },

  async submitAppraisal(id, data = {}) {
    return this.submitRecord(id, data);
  },

  async managerReview(id, data) {
    const res = await http.post(`/v1/performance/records/${id}/manager-review`, data);
    return res.data;
  },

  async returnRecord(id, data) {
    const res = await http.post(`/v1/performance/records/${id}/return`, data);
    return res.data;
  },

  async returnAppraisal(id, data) {
    return this.returnRecord(id, data);
  },

  async hrApprove(id, data = {}) {
    const res = await http.post(`/v1/performance/records/${id}/hr-approve`, data);
    return res.data;
  },

  async rejectRecord(id, data) {
    const res = await http.post(`/v1/performance/records/${id}/reject`, data);
    return res.data;
  },

  async rejectAppraisal(id, data) {
    return this.rejectRecord(id, data);
  },

  async getRecordHistory(id) {
    const res = await http.get(`/v1/performance/records/${id}/history`);
    return res.data;
  },
};

export default performanceService;
