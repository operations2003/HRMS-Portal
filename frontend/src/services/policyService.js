import { http } from './api.js';

export const policyService = {
  async listPolicies(params = {}) {
    const query = new URLSearchParams();
    if (params.category) query.append('category', params.category);
    if (params.search) query.append('search', params.search);
    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await http.get(`/v1/policies${qs}`);
    return res.data;
  },

  async getPolicyById(id) {
    const res = await http.get(`/v1/policies/${id}`);
    return res.data;
  },

  async createPolicy(data) {
    const res = await http.post('/v1/policies', data);
    return res.data;
  },

  async updatePolicy(id, data) {
    const res = await http.put(`/v1/policies/${id}`, data);
    return res.data;
  },

  async deletePolicy(id) {
    const res = await http.delete(`/v1/policies/${id}`);
    return res.data;
  },
};
