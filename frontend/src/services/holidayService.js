import { http } from './api.js';

export const holidayService = {
  /**
   * Fetch holidays for current organization with optional filters (year, status)
   */
  async getHolidays(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await http.get(`/v1/holidays${query ? `?${query}` : ''}`);
    return res.data || [];
  },

  /**
   * Declare / create a company holiday (Admin only)
   */
  async createHoliday(data) {
    const res = await http.post('/v1/holidays', data);
    return res.data;
  },

  /**
   * Update an existing holiday (Admin only)
   */
  async updateHoliday(id, data) {
    const res = await http.put(`/v1/holidays/${id}`, data);
    return res.data;
  },

  /**
   * Delete / remove a holiday (Admin only)
   */
  async deleteHoliday(id) {
    const res = await http.delete(`/v1/holidays/${id}`);
    return res.data;
  },
};

