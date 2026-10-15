import { http } from './api.js';

let cachedDepartments = null;
let lastFetchTime = 0;
const DEPT_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

export const departmentService = {
  async getDepartments(force = false) {
    const now = Date.now();
    if (!force && cachedDepartments && (now - lastFetchTime < DEPT_CACHE_TTL_MS)) {
      return cachedDepartments;
    }
    const res = await http.get('/v1/departments');
    cachedDepartments = res.data;
    lastFetchTime = Date.now();
    return res.data;
  },

  async getAllDepartments(force = false) {
    return this.getDepartments(force);
  },

  async getDepartmentById(id) {
    const res = await http.get(`/v1/departments/${id}`);
    return res.data;
  },

  async createDepartment(data) {
    cachedDepartments = null;
    const res = await http.post('/v1/departments', data);
    return res.data;
  },

  async updateDepartment(id, data) {
    cachedDepartments = null;
    const res = await http.put(`/v1/departments/${id}`, data);
    return res.data;
  },

  async deleteDepartment(id) {
    cachedDepartments = null;
    const res = await http.delete(`/v1/departments/${id}`);
    return res.data;
  },
};
