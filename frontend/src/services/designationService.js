import { http } from './api.js';

export const designationService = {
  async getDesignations() {
    const res = await http.get('/v1/designations');
    return res.data;
  },

  async getDesignationById(id) {
    const res = await http.get(`/v1/designations/${id}`);
    return res.data;
  },

  async createDesignation(data) {
    const res = await http.post('/v1/designations', data);
    return res.data;
  },

  async updateDesignation(id, data) {
    const res = await http.put(`/v1/designations/${id}`, data);
    return res.data;
  },

  async deleteDesignation(id) {
    const res = await http.delete(`/v1/designations/${id}`);
    return res.data;
  },
};
