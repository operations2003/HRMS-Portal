import { http } from './api.js';

export const payrollService = {
  /**
   * Fetch current employee's salary breakdown, masked bank details, UAN, and pay history.
   * Accessible to all authenticated roles for self-payroll.
   */
  async getMyPayroll() {
    const res = await http.get('/v1/payroll/my');
    return res.data;
  },

  /**
   * Fetch organization-wide payroll list and summary metrics.
   * Strictly for Admin / CEO and HR.
   */
  async getOrganizationPayroll() {
    const res = await http.get('/v1/payroll/organization');
    return res.data;
  },

  /**
   * Fetch specific employee's full salary breakdown by employee ID.
   * Admin / CEO and HR can view any employee; Managers and Employees can view only their own.
   */
  async getEmployeePayroll(employeeId) {
    const res = await http.get(`/v1/payroll/employee/${employeeId}`);
    return res.data;
  },

  /**
   * Decide / update an employee's salary.
   * Admin represents the CEO/organization head who decides and gives salaries.
   */
  async updateEmployeeSalary(employeeId, salary) {
    const res = await http.put(`/v1/payroll/employee/${employeeId}/salary`, { salary });
    return res.data;
  },
};

export default payrollService;
