import { http } from './api.js';

export const profileService = {
  async getMyProfile() {
    const res = await http.get('/v1/employees/me/profile');
    return res.data;
  },

  async updateMyProfile(data) {
    const res = await http.put('/v1/employees/me/profile', data);
    return res.data;
  },

  async getProfileById(employeeId) {
    const res = await http.get(`/v1/employees/${employeeId}/profile`);
    return res.data;
  },
};
