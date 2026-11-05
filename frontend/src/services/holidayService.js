import { http } from './api.js';

/**
 * Helper to execute HTTP requests with endpoint fallback
 */
async function requestWithFallback(paths, method = 'get', body = null) {
  let lastError = null;
  for (const p of paths) {
    try {
      if (method === 'get') return await http.get(p);
      if (method === 'post') return await http.post(p, body);
      if (method === 'put') return await http.put(p, body);
      if (method === 'delete') return await http.delete(p);
    } catch (err) {
      lastError = err;
      const isNotFound =
        err.status === 404 ||
        err.message?.includes('not found') ||
        err.message?.includes('404');
      if (!isNotFound) {
        // If it's a 400 validation error, 403 forbidden, or 500 error, don't cascade, throw immediately
        throw err;
      }
      // Continue to next path candidate on 404
    }
  }

  // If all path variants returned 404
  if (lastError) {
    const customErr = new Error(
      lastError.message?.includes('not found')
        ? 'Holiday API route is initializing or server needs a reload. Please ensure the backend server has restarted.'
        : lastError.message || 'Holiday service is currently unavailable.'
    );
    customErr.status = 404;
    throw customErr;
  }
}

export const holidayService = {
  /**
   * Fetch holidays for current organization with optional filters (year, status)
   */
  async getHolidays(params = {}) {
    const query = new URLSearchParams(params).toString();
    const qs = query ? `?${query}` : '';
    const candidates = [
      `/v1/holidays${qs}`,
      `/v1/leaves/holidays${qs}`,
      `/holidays${qs}`,
      `/leaves/holidays${qs}`,
    ];

    const res = await requestWithFallback(candidates, 'get');
    return res?.data || [];
  },

  /**
   * Declare / create a company holiday (Admin/CEO only)
   */
  async createHoliday(data) {
    const candidates = [
      '/v1/holidays',
      '/v1/leaves/holidays',
      '/holidays',
      '/leaves/holidays',
    ];
    const res = await requestWithFallback(candidates, 'post', data);
    return res?.data;
  },

  /**
   * Update an existing holiday (Admin/CEO only)
   */
  async updateHoliday(id, data) {
    const candidates = [
      `/v1/holidays/${id}`,
      `/v1/leaves/holidays/${id}`,
      `/holidays/${id}`,
      `/leaves/holidays/${id}`,
    ];
    const res = await requestWithFallback(candidates, 'put', data);
    return res?.data;
  },

  /**
   * Delete / remove a holiday (Admin/CEO only)
   */
  async deleteHoliday(id) {
    const candidates = [
      `/v1/holidays/${id}`,
      `/v1/leaves/holidays/${id}`,
      `/holidays/${id}`,
      `/leaves/holidays/${id}`,
    ];
    const res = await requestWithFallback(candidates, 'delete');
    return res?.data;
  },
};
