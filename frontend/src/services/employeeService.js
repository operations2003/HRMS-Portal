import { http } from './api.js';

export const employeeService = {
  async listEmployees(params = {}) {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.deptId) query.append('deptId', params.deptId);
    if (params.orgId) query.append('orgId', params.orgId);
    if (params.status) query.append('status', params.status);
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    const queryString = query.toString() ? `?${query.toString()}` : '';

    const res = await http.get(`/v1/employees${queryString}`);
    const raw = res?.data || {};
    const employees = Array.isArray(raw)
      ? raw
      : (Array.isArray(raw.employees) ? raw.employees : (Array.isArray(res) ? res : []));
    return {
      ...raw,
      employees,
      items: employees,
      data: employees,
      pagination: raw.pagination || { total: employees.length, page: 1, limit: 20, totalPages: 1 },
    };
  },

  async getAllEmployees(params = {}) {
    return this.listEmployees({ limit: 1000, ...params });
  },


  async getMetadata() {
    const res = await http.get('/v1/employees/metadata');
    return res.data;
  },

  async getEmployeeById(id) {
    const res = await http.get(`/v1/employees/${id}`);
    return res.data;
  },

  async createEmployee(data) {
    const res = await http.post('/v1/employees', data);
    return res.data;
  },

  async updateEmployee(id, data) {
    const res = await http.put(`/v1/employees/${id}`, data);
    return res.data;
  },

  async deleteEmployee(id) {
    const res = await http.delete(`/v1/employees/${id}`);
    return res.data;
  },
};
