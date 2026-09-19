import { http } from './api.js';

export const departmentService = {
  async getDepartments() {
    const res = await http.get('/v1/departments');
    return res.data;
  },

  async getAllDepartments() {
    return this.getDepartments();
  },

  async getDepartmentById(id) {
    const res = await http.get(`/v1/departments/${id}`);
    return res.data;
  },

  async createDepartment(data) {
    const res = await http.post('/v1/departments', data);
    return res.data;
  },

  async updateDepartment(id, data) {
    const res = await http.put(`/v1/departments/${id}`, data);
    return res.data;
  },

  async deleteDepartment(id) {
    const res = await http.delete(`/v1/departments/${id}`);
    return res.data;
  },
};
