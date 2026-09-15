import { http } from './api.js';

export const dashboardService = {
  async getStats() {
    const res = await http.get('/v1/dashboard/stats');
    return res.data;
  },
};
