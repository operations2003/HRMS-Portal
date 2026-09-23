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
   * Decide / update an employee's salary and structure.
   * Admin represents the CEO/organization head who decides and gives salaries.
   * HR has payroll authority to manage and decide salaries.
   */
  async updateEmployeeSalary(employeeId, payload) {
    const body = typeof payload === 'object' && payload !== null ? payload : { salary: payload };
    const res = await http.put(`/v1/payroll/employee/${employeeId}/salary`, body);
    return res.data;
  },

  /**
   * Pay / disburse monthly salary to a specific employee.
   * Admin & HR authority.
   */
  async payEmployee(employeeId, data = {}) {
    const res = await http.post(`/v1/payroll/employee/${employeeId}/pay`, data);
    return res.data;
  },

  /**
   * Run organization-wide payroll disbursement for all salaried staff.
   * Admin & HR authority.
   */
  async disburseAll(data = {}) {
    const res = await http.post('/v1/payroll/disburse-all', data);
    return res.data;
  },
};

export default payrollService;
