import { http } from './api.js';

export const performanceReportService = {
  /**
   * Send a performance report specifically to the selected employee
   */
  async sendReport(data) {
    const res = await http.post('/v1/performance-reports/send', data);
    return res.data;
  },

  /**
   * Get active performance reports delivered specifically to the current user
   */
  async getMyReports() {
    const res = await http.get('/v1/performance-reports/my');
    return res.data;
  },

  /**
   * Delete / dismiss a performance report by recipient user
   */
  async deleteMyReport(id) {
    const res = await http.delete(`/v1/performance-reports/${id}`);
    return res.data;
  },

  /**
   * Get all sent performance reports (for Admin, HR, Manager)
   */
  async getSentReports(params = {}) {
    const res = await http.get('/v1/performance-reports/sent', { params });
    return res.data;
  },

  /**
   * Get sent status for a specific employee and department
   */
  async getEmployeeStatus(employeeId, department) {
    const res = await http.get(`/v1/performance-reports/status/${employeeId}`, {
      params: { department },
    });
    return res.data;
  },
};

export default performanceReportService;
