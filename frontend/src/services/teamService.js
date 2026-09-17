import { http } from './api.js';

export const teamService = {
  async getTeam(params = {}) {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.status) query.append('status', params.status);
    if (params.deptId) query.append('deptId', params.deptId);
    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await http.get(`/v1/team${qs}`);
    return res.data;
  },

  async getTeamMembers(params = {}) {
    return this.getTeam(params);
  },

  async getTeamSummary() {
    const res = await http.get('/v1/team/summary');
    return res.data;
  },

  async getTeamMember(employeeId) {
    const res = await http.get(`/v1/team/members/${employeeId}`);
    return res.data;
  },

  async getMemberById(employeeId) {
    return this.getTeamMember(employeeId);
  },

  async getTeamAttendance(params = {}) {
    const query = new URLSearchParams();
    if (params.date) query.append('date', params.date);
    if (params.status) query.append('status', params.status);
    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await http.get(`/v1/team/attendance${qs}`);
    return res.data;
  },

  async getTeamAttendanceSummary(params = {}) {
    const query = new URLSearchParams();
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    if (params.managerId) query.append('managerId', params.managerId);
    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await http.get(`/v1/team/attendance/summary${qs}`);
    return res.data;
  },

  async getTeamMemberAttendance(employeeId) {
    const res = await http.get(`/v1/team/members/${employeeId}/attendance`);
    return res.data;
  },

  async getTeamLeaves(params = {}) {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await http.get(`/v1/team/leaves${qs}`);
    return res.data;
  },

  async getTeamLeavesSummary() {
    const res = await http.get('/v1/team/leaves/summary');
    return res.data;
  },

  async getTeamMemberLeaves(employeeId) {
    const res = await http.get(`/v1/team/members/${employeeId}/leaves`);
    return res.data;
  },

  async getTeamPerformance(params = {}) {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await http.get(`/v1/team/performance${qs}`);
    return res.data;
  },

  async getTeamPerformanceSummary() {
    const res = await http.get('/v1/team/performance/summary');
    return res.data;
  },

  async getTeamMemberPerformance(employeeId) {
    const res = await http.get(`/v1/team/members/${employeeId}/performance`);
    return res.data;
  },

  async assignManager(data) {
    const res = await http.patch('/v1/team/assign', data);
    return res.data;
  },
};

export default teamService;
