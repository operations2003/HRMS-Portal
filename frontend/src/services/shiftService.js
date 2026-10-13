import { http } from './api.js';

export const shiftService = {
  /**
   * Get employees that caller is authorized to manage (HR/Admin: all active, Manager: team reports)
   */
  async getEligibleEmployees() {
    const res = await http.get('/v1/shifts/eligible-employees');
    const raw = res?.data ?? res;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.employees)) return raw.employees;
    if (Array.isArray(raw?.data)) return raw.data;
    return [];
  },

  /**
   * Get shift schedule and date-wise overrides for an employee in a date range
   */
  async getEmployeeShifts({ employeeId, startDate, endDate, month, year } = {}) {
    const params = new URLSearchParams();
    if (employeeId) params.append('employeeId', employeeId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (month) params.append('month', month);
    if (year) params.append('year', year);
    if (departmentId) params.append('departmentId', departmentId);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await http.get(`/v1/shifts/assignments${qs}`);
    return res?.data ?? res ?? {};
  },

  /**
   * Assign or edit shift timings for one or multiple specific dates
   */
  async assignShifts({
    employeeId,
    dates,
    shiftType = 'SHIFT',
    shiftLabel,
    shiftStartTime,
    shiftEndTime,
    notes = '',
  }) {
    const res = await http.post('/v1/shifts/assign', {
      employeeId,
      dates,
      shiftType,
      shiftLabel,
      shiftStartTime,
      shiftEndTime,
      notes,
    });
    return res?.data || res;
  },

  /**
   * Reset specific dates back to standard default shift
   */
  async resetShifts({ employeeId, dates }) {
    const res = await http.post('/v1/shifts/reset', {
      employeeId,
      dates,
    });
    return res?.data || res;
  },

  /**
   * Get shift change audit trail
   */
  async getAuditHistory({ employeeId, page = 1, limit = 50 } = {}) {
    const params = new URLSearchParams();
    if (employeeId) params.append('employeeId', employeeId);
    if (page) params.append('page', page);
    if (limit) params.append('limit', limit);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await http.get(`/v1/shifts/audit-history${qs}`);
    return res?.data || res || { history: [], total: 0 };
  },
};

export default shiftService;
