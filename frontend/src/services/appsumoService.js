import { http } from './api.js';

export const appsumoService = {
  /**
   * Exchange single-use OAuth authorization code from ?code=...
   */
  async exchangeOAuthCode(code, redirectUri) {
    const res = await http.post('/v1/appsumo/oauth/exchange', { code, redirectUri });
    return res.data;
  },

  /**
   * Activate & link AppSumo license to an organization
   */
  async activateLicense(payload) {
    const res = await http.post('/v1/appsumo/activate', payload);
    return res.data;
  },

  /**
   * Get organization's active AppSumo entitlement & tier quotas
   */
  async getEntitlement() {
    const res = await http.get('/v1/appsumo/entitlement');
    return res.data;
  },

  /**
   * SuperAdmin / Admin: List all licenses
   */
  async listAdminLicenses(params = {}) {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.status) query.append('status', params.status);
    if (params.tier) query.append('tier', params.tier);
    if (params.limit) query.append('limit', params.limit);
    if (params.offset) query.append('offset', params.offset);
    const queryString = query.toString() ? `?${query.toString()}` : '';

    const res = await http.get(`/v1/appsumo/admin/licenses${queryString}`);
    return res.data;
  },

  /**
   * SuperAdmin / Admin: View license details and event history
   */
  async getAdminLicenseDetail(licenseKey) {
    const res = await http.get(`/v1/appsumo/admin/licenses/${encodeURIComponent(licenseKey)}`);
    return res.data;
  },
};
