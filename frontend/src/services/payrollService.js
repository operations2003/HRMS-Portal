import { http } from './api.js';

export const payrollService = {
  /**
   * Fetch current employee's salary breakdown, masked bank details, UAN, and pay history.
   * Note: Payslip downloads are disabled by policy.
   */
  async getMyPayroll() {
    const res = await http.get('/v1/payroll/my');
    return res.data;
  },
};
