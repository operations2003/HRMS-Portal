import { http } from './api.js';

export const managerService = {
  async getDashboard() {
    const res = await http.get('/v1/manager/dashboard');
    return res.data;
  },

  async getProfile() {
    const res = await http.get('/v1/manager/profile');
    return res.data;
  },

  async getTeam() {
    const res = await http.get('/v1/manager/team');
    return res.data;
  },

  async getTeamSummary() {
    const res = await http.get('/v1/manager/team/summary');
    return res.data;
  },

  async getTeamMember(employeeId) {
    const res = await http.get(`/v1/manager/team/members/${employeeId}`);
    return res.data;
  },

  async getTeamAttendance(params = {}) {
    const query = new URLSearchParams();
    if (params.date) query.append('date', params.date);
    if (params.status) query.append('status', params.status);
    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await http.get(`/v1/manager/team/attendance${qs}`);
    return res.data;
  },

  async getTeamAttendanceSummary() {
    const res = await http.get('/v1/manager/team/attendance/summary');
    return res.data;
  },

  async getTeamMemberAttendance(employeeId) {
    const res = await http.get(`/v1/manager/team/members/${employeeId}/attendance`);
    return res.data;
  },

  async getTeamLeaves(params = {}) {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await http.get(`/v1/manager/team/leaves${qs}`);
    return res.data;
  },

  async getTeamMemberLeaves(employeeId) {
    const res = await http.get(`/v1/manager/team/members/${employeeId}/leaves`);
    return res.data;
  },

  async approveTeamLeave(leaveId, payload = {}) {
    const res = await http.post(`/v1/manager/team/leaves/${leaveId}/approve`, payload);
    return res.data;
  },

  async rejectTeamLeave(leaveId, payload = {}) {
    const res = await http.post(`/v1/manager/team/leaves/${leaveId}/reject`, payload);
    return res.data;
  },

  async getTeamPerformance(params = {}) {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await http.get(`/v1/manager/team/performance${qs}`);
    return res.data;
  },

  async getTeamMemberPerformance(employeeId) {
    const res = await http.get(`/v1/manager/team/members/${employeeId}/performance`);
    return res.data;
  },

  async getPendingApprovals() {
    const res = await http.get('/v1/manager/approvals');
    return res.data;
  },

  async assignManager(data) {
    const res = await http.patch('/v1/manager/assign', data);
    return res.data;
  },
};

export default managerService;
