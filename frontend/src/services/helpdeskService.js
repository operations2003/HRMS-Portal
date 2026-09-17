import { http } from './api.js';

export const helpdeskService = {
  /**
   * Get employee's own tickets
   */
  async getMyTickets(params = {}) {
    const res = await http.get('/v1/helpdesk/my/tickets', { params });
    return res.data;
  },

  /**
   * List all tickets (HR / Admin / Support)
   */
  async listTickets(params = {}) {
    const res = await http.get('/v1/helpdesk/tickets', { params });
    return res.data;
  },

  /**
   * Get ticket details with comment thread
   */
  async getTicketById(id) {
    const res = await http.get(`/v1/helpdesk/tickets/${id}`);
    return res.data;
  },

  /**
   * Create a new ticket
   */
  async createTicket(data) {
    const res = await http.post('/v1/helpdesk/tickets', data);
    return res.data;
  },

  /**
   * Add a response/comment to a ticket
   */
  async addComment(id, data) {
    const res = await http.post(`/v1/helpdesk/tickets/${id}/comments`, data);
    return res.data;
  },

  /**
   * Cancel ticket (by employee or admin)
   */
  async cancelTicket(id) {
    const res = await http.post(`/v1/helpdesk/tickets/${id}/cancel`);
    return res.data;
  },

  /**
   * Assign ticket to staff or team (HR/Admin)
   */
  async assignTicket(id, data) {
    const res = await http.post(`/v1/helpdesk/tickets/${id}/assign`, data);
    return res.data;
  },

  /**
   * Update ticket status (HR/Admin)
   */
  async updateStatus(id, status) {
    const res = await http.patch(`/v1/helpdesk/tickets/${id}/status`, { status });
    return res.data;
  },

  /**
   * Resolve ticket with resolution summary (HR/Admin)
   */
  async resolveTicket(id, resolution) {
    const res = await http.post(`/v1/helpdesk/tickets/${id}/resolve`, { resolution });
    return res.data;
  },

  /**
   * Close ticket (HR/Admin)
   */
  async closeTicket(id) {
    const res = await http.post(`/v1/helpdesk/tickets/${id}/close`);
    return res.data;
  },

  /**
   * Get ticket overview metrics
   */
  async getStats() {
    const res = await http.get('/v1/helpdesk/stats');
    return res.data;
  },
};

export default helpdeskService;
