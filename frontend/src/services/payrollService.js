import { http } from './api.js';

export const payrollService = {
  // =========================================================================
  // Employee Self-Service (IDOR Protected)
  // =========================================================================

  /**
   * Get authenticated user's own payroll records
   * @param {Object} params - { periodId, status, limit }
   */
  async getMyRecords(params = {}) {
    const query = new URLSearchParams();
    if (params.periodId) query.append('periodId', params.periodId);
    if (params.status) query.append('status', params.status);
    if (params.limit) query.append('limit', params.limit);
    const queryString = query.toString() ? `?${query.toString()}` : '';

    const res = await http.get(`/v1/payroll/my/records${queryString}`);
    return res.data || [];
  },

  /**
   * Get authenticated user's specific payroll record with itemized earnings & deductions
   * @param {string} id - Payroll record ID
   */
  async getMyRecordById(id) {
    const res = await http.get(`/v1/payroll/my/records/${id}`);
    return res.data;
  },

  /**
   * Get authenticated user's payslips
   * @param {Object} params - { periodId, limit }
   */
  async getMyPayslips(params = {}) {
    const query = new URLSearchParams();
    if (params.periodId) query.append('periodId', params.periodId);
    if (params.limit) query.append('limit', params.limit);
    const queryString = query.toString() ? `?${query.toString()}` : '';

    const res = await http.get(`/v1/payroll/my/payslips${queryString}`);
    return res.data || [];
  },

  /**
   * Get single payslip by ID for authenticated user
   * @param {string} id - Payslip ID
   */
  async getMyPayslipById(id) {
    const res = await http.get(`/v1/payroll/my/payslips/${id}`);
    return res.data;
  },

  // =========================================================================
  // HR / Admin Operations
  // =========================================================================

  /**
   * Get organization executive payroll summary (YTD totals, pending payout, latest period)
   */
  async getOrganizationSummary() {
    const res = await http.get('/v1/payroll/summary');
    return res.data || {};
  },

  /**
   * List all payroll periods
   * @param {Object} params - { status, search, limit }
   */
  async getPeriods(params = {}) {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.search) query.append('search', params.search);
    if (params.limit) query.append('limit', params.limit);
    const queryString = query.toString() ? `?${query.toString()}` : '';

    const res = await http.get(`/v1/payroll/periods${queryString}`);
    return res.data || [];
  },

  /**
   * Get single period details
   * @param {string} id - Period ID
   */
  async getPeriodById(id) {
    const res = await http.get(`/v1/payroll/periods/${id}`);
    return res.data;
  },

  /**
   * Get period summary statistics
   * @param {string} id - Period ID
   */
  async getPeriodSummary(id) {
    const res = await http.get(`/v1/payroll/periods/${id}/summary`);
    return res.data;
  },

  /**
   * List employee payroll records across the organization
   * @param {Object} params - { periodId, employeeId, status, search, limit }
   */
  async getRecords(params = {}) {
    const query = new URLSearchParams();
    if (params.periodId) query.append('periodId', params.periodId);
    if (params.employeeId) query.append('employeeId', params.employeeId);
    if (params.status) query.append('status', params.status);
    if (params.search) query.append('search', params.search);
    if (params.limit) query.append('limit', params.limit);
    const queryString = query.toString() ? `?${query.toString()}` : '';

    const res = await http.get(`/v1/payroll/records${queryString}`);
    return res.data || [];
  },

  /**
   * Get record details by ID with line items
   * @param {string} id - Record ID
   */
  async getRecordById(id) {
    const res = await http.get(`/v1/payroll/records/${id}`);
    return res.data;
  },

  /**
   * List all payslips across the organization
   * @param {Object} params - { periodId, employeeId, status, search, limit }
   */
  async getPayslips(params = {}) {
    const query = new URLSearchParams();
    if (params.periodId) query.append('periodId', params.periodId);
    if (params.employeeId) query.append('employeeId', params.employeeId);
    if (params.status) query.append('status', params.status);
    if (params.search) query.append('search', params.search);
    if (params.limit) query.append('limit', params.limit);
    const queryString = query.toString() ? `?${query.toString()}` : '';

    const res = await http.get(`/v1/payroll/payslips${queryString}`);
    return res.data || [];
  },

  /**
   * Track payslip download
   * @param {string} id - Payslip ID
   */
  async recordPayslipDownload(id) {
    const res = await http.post(`/v1/payroll/payslips/${id}/download`, {});
    return res.data;
  },
};
