import { http } from './api.js';

export const documentService = {
  // =========================================================================
  // Employee Self-Service (IDOR Protected)
  // =========================================================================

  /**
   * Get authenticated employee's authorized documents from Document Vault
   */
  async getMyDocuments() {
    const res = await http.get('/v1/documents/my');
    return res.data || [];
  },

  /**
   * Upload an authorized document to Document Vault for authenticated employee
   * @param {FormData} formData - Multipart form containing 'file', 'category', 'documentType', 'title'
   */
  async uploadMyDocument(formData) {
    const res = await http.upload('/v1/documents/my/upload', formData);
    return res.data;
  },

  /**
   * Acknowledge receipt/terms of a document in vault
   * @param {string} id - Document ID
   */
  async acknowledgeDocument(id) {
    const res = await http.post(`/v1/documents/${id}/acknowledge`, {});
    return res.data;
  },

  // =========================================================================
  // Shared & Admin / HR Operations
  // =========================================================================

  /**
   * Get document by ID (IDOR protected for non-HR/Admin users)
   * @param {string} id - Document ID
   */
  async getDocumentById(id) {
    const res = await http.get(`/v1/documents/${id}`);
    return res.data;
  },

  /**
   * Get documents for an owner (EMPLOYEE, NEW_HIRE, CANDIDATE)
   * @param {string} ownerType - 'EMPLOYEE' | 'NEW_HIRE' | 'CANDIDATE'
   * @param {string} ownerId - ID of employee or new hire
   */
  async getDocumentsByOwner(ownerType, ownerId) {
    const res = await http.get(`/v1/documents/owner/${ownerType}/${ownerId}`);
    return res.data || [];
  },

  /**
   * Verify document (HR / Admin action: approve or reject with reason)
   * @param {string} id - Document ID
   * @param {Object} data - { verificationStatus: 'APPROVED' | 'REJECTED', rejectionReason }
   */
  async verifyDocument(id, { verificationStatus, rejectionReason }) {
    const res = await http.patch(`/v1/documents/${id}/verify`, {
      verificationStatus,
      rejectionReason,
    });
    return res.data;
  },

  /**
   * Delete document from Document Vault (HR / Admin action)
   * @param {string} id - Document ID
   */
  async deleteDocument(id) {
    const res = await http.delete(`/v1/documents/${id}`);
    return res.data;
  },

  /**
   * Securely download document with auth headers
   * @param {string} id - Document ID
   * @param {string} filename - Fallback filename
   */
  async downloadDocument(id, filename) {
    return await http.download(`/v1/documents/${id}/download`, filename);
  },

  /**
   * Securely view document in new tab with auth headers
   * @param {string} id - Document ID
   */
  async viewDocument(id) {
    return await http.openInNewTab(`/v1/documents/${id}/download`);
  },
};
