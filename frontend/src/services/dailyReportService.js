import { http } from './api.js';

export const dailyReportService = {
  /**
   * Submit or update today's daily work report
   * @param {Object} data - { workSummary, reportDate }
   */
  async submitReport(data) {
    const res = await http.post('/v1/daily-reports', data);
    return res;
  },

  /**
   * Get employee's report for today
   * @param {string} date - YYYY-MM-DD
   */
  async getMyTodayReport(date) {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    const res = await http.get(`/v1/daily-reports/my/today${query}`);
    return res;
  },

  /**
   * Get employee's past reports history
   * @param {Object} params - { page, limit }
   */
  async getMyReports(params = {}) {
    const searchParams = new URLSearchParams(params).toString();
    const query = searchParams ? `?${searchParams}` : '';
    const res = await http.get(`/v1/daily-reports/my${query}`);
    return res;
  },

  /**
   * Get team / organization daily work reports (Manager, HR, Admin)
   * @param {Object} params - { page, limit, search, date, status }
   */
  async getTeamReports(params = {}) {
    const searchParams = new URLSearchParams(params).toString();
    const query = searchParams ? `?${searchParams}` : '';
    const res = await http.get(`/v1/daily-reports/team${query}`);
    return res;
  },

  /**
   * Get summary & compliance rate for a date
   * @param {string} date - YYYY-MM-DD
   */
  async getSummary(date) {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    const res = await http.get(`/v1/daily-reports/summary${query}`);
    return res;
  },

  /**
   * Acknowledge and add feedback to a report
   * @param {string} id
   * @param {string} feedbackText
   */
  async addFeedback(id, feedbackText) {
    const res = await http.post(`/v1/daily-reports/${id}/feedback`, { feedback: feedbackText });
    return res;
  },
};
