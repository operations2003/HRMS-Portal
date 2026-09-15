import { http } from './api.js';

export const orgService = {
  async listOrganizations(params = {}) {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.status) query.append('status', params.status);
    const queryString = query.toString() ? `?${query.toString()}` : '';

    const res = await http.get(`/v1/organizations${queryString}`);
    return res.data;
  },

  async getOrganizationById(id) {
    const res = await http.get(`/v1/organizations/${id}`);
    return res.data;
  },

  async createOrganization(data) {
    const res = await http.post('/v1/organizations', data);
    return res.data;
  },

  async updateOrganization(id, data) {
    const res = await http.put(`/v1/organizations/${id}`, data);
    return res.data;
  },

  async deleteOrganization(id) {
    const res = await http.delete(`/v1/organizations/${id}`);
    return res.data;
  },
};
