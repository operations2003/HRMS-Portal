import { http } from './api.js';

export const onboardingService = {
  /**
   * Fetch listing of new hires with filters
   */
  async getNewHires(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const queryString = query.toString() ? `?${query.toString()}` : '';
    const res = await http.get(`/v1/onboarding/new-hires${queryString}`);
    return {
      items: res.data || [],
      pagination: res.meta || { total: res.data?.length || 0, page: 1, limit: 20 },
    };
  },

  /**
   * Fetch single new hire details
   */
  async getNewHireById(id) {
    const res = await http.get(`/v1/onboarding/${id}`);
    return res.data;
  },

  /**
   * Fetch composite onboarding status (checklist, docs, IT setup, BGV)
   */
  async getOnboardingStatus(id) {
    const res = await http.get(`/v1/onboarding/${id}/status`);
    return res.data;
  },

  /**
   * Update workflow checklist items
   */
  async updateChecklist(id, updates) {
    const res = await http.patch(`/v1/onboarding/${id}/checklist`, updates);
    return res.data;
  },

  /**
   * Upload file to Document Vault for candidate
   */
  async uploadDocument(newHireId, formData) {
    const res = await http.upload(`/v1/onboarding/${newHireId}/documents/upload`, formData);
    return res.data;
  },

  /**
   * Verify document (Approve/Reject)
   */
  async verifyDocument(docId, { verificationStatus, rejectionReason }) {
    const res = await http.patch(`/v1/onboarding/documents/${docId}/verify`, {
      verificationStatus,
      rejectionReason,
    });
    return res.data;
  },

  /**
   * Fetch IT Setup status
   */
  async getItSetup(id) {
    const res = await http.get(`/v1/onboarding/${id}/it-setup`);
    return res.data;
  },

  /**
   * Update IT Setup provisioning
   */
  async updateItSetup(id, data) {
    const res = await http.patch(`/v1/onboarding/${id}/it-setup`, data);
    return res.data;
  },

  /**
   * Day-1 Conversion to active Employee Master
   */
  async convertToEmployee(id, overrides = {}) {
    const res = await http.post(`/v1/onboarding/${id}/convert-to-employee`, overrides);
    return res.data;
  },

  /**
   * Trigger ATS Handoff (simulated or manual intake)
   */
  async triggerAtsHandoff(payload, idempotencyKey = null) {
    const options = {};
    if (idempotencyKey) {
      options.headers = { 'Idempotency-Key': idempotencyKey };
    }
    const res = await http.post('/v1/onboarding/ats-handoff', payload, options);
    return res;
  },
};

export default onboardingService;
