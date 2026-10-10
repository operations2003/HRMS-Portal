import { http } from './api.js';

export const rosterService = {
  /**
   * Upload and parse roster file
   */
  async uploadRoster(formData) {
    const res = await http.post('/v1/roster/upload', formData);
    return res;
  },

  /**
   * Get preview of uploaded roster
   */
  async getPreview(jobId) {
    const res = await http.get(`/v1/roster/preview/${jobId}`);
    return res.data;
  },

  /**
   * Resolve ambiguous employee mapping
   */
  async resolveAmbiguity(mappingId, selectedEmployeeId) {
    const res = await http.post('/v1/roster/resolve-ambiguity', {
      mappingId,
      selectedEmployeeId,
    });
    return res.data;
  },

  /**
   * Automatically resolve all ambiguous mappings using AI
   */
  async aiAutoResolve(jobId) {
    const res = await http.post(`/v1/roster/ai-auto-resolve/${jobId}`);
    return res.data;
  },

  /**
   * Confirm and apply roster import
   */
  async confirmImport(jobId) {
    const res = await http.post(`/v1/roster/confirm/${jobId}`);
    return res.data;
  },

  /**
   * Get roster import history
   */
  async getImportHistory(params = {}) {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    const queryString = query.toString() ? `?${query.toString()}` : '';

    const res = await http.get(`/v1/roster/history${queryString}`);
    return res.data;
  },

  /**
   * Get shift assignments
   */
  async getAssignments(params = {}) {
    const query = new URLSearchParams();
    if (params.employeeId) query.append('employeeId', params.employeeId);
    if (params.month) query.append('month', params.month);
    if (params.year) query.append('year', params.year);
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    const queryString = query.toString() ? `?${query.toString()}` : '';

    const res = await http.get(`/v1/roster/assignments${queryString}`);
    return res.data;
  },
};
