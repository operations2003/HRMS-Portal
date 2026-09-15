import { http } from './api.js';

export const authService = {
  async login(email, password) {
    const res = await http.post('/v1/auth/login', { email, password });
    return res.data;
  },

  async logout() {
    try {
      await http.post('/v1/auth/logout', {});
    } finally {
      localStorage.removeItem('hrms_token');
      localStorage.removeItem('hrms_user');
    }
  },

  async getMe() {
    const res = await http.get('/v1/auth/me');
    return res.data;
  },
};
