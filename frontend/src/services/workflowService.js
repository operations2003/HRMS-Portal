import { http } from './api.js';

export const workflowService = {
  /**
   * Get pending approval queue for current manager / HR / admin
   * @param {Object} params { entityType, status }
   */
  async getPendingQueue(params = {}) {
    const query = new URLSearchParams();
    if (params.entityType) query.append('entityType', params.entityType);
    if (params.status) query.append('status', params.status);
    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await http.get(`/v1/workflows/pending${qs}`);
    return res.data;
  },

  /**
   * Get workflow instance by ID
   * @param {string} id 
   */
  async getWorkflowById(id) {
    const res = await http.get(`/v1/workflows/${id}`);
    return res.data;
  },

  /**
   * Execute action on a workflow instance (APPROVE, REJECT, RETURN)
   * @param {string} id 
   * @param {Object} data { action, comment }
   */
  async executeAction(id, data) {
    const res = await http.post(`/v1/workflows/${id}/action`, data);
    return res.data;
  },

  /**
   * Get immutable audit trail for a specific entity
   * @param {string} entityType 
   * @param {string} entityId 
   */
  async getAuditTrail(entityType, entityId) {
    const res = await http.get(`/v1/workflows/entity/${entityType}/${entityId}/audit`);
    return res.data;
  }
};
