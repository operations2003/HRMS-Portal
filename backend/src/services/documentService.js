import { documentRepository } from '../repositories/documentRepository.js';

export const documentService = {
  /**
   * Upload or add document metadata to Document Vault
   */
  async addDocument(data) {
    if (!data.orgId || !data.ownerId || !data.category || !data.fileUrl || !data.title) {
      const err = new Error('Missing required document fields: orgId, ownerId, category, fileUrl, title.');
      err.statusCode = 400;
      throw err;
    }

    return documentRepository.create(data);
  },

  /**
   * Get documents by owner
   */
  async getDocumentsByOwner(ownerType, ownerId) {
    return documentRepository.findByOwner(ownerType.toUpperCase(), ownerId);
  },

  /**
   * Get document by ID
   */
  async getDocumentById(id) {
    const doc = await documentRepository.findById(id);
    if (!doc) {
      const err = new Error(`Document '${id}' not found.`);
      err.statusCode = 404;
      throw err;
    }
    return doc;
  },

  /**
   * Verify document (Approve or Reject)
   */
  async verifyDocument(id, { verificationStatus, verifiedBy, rejectionReason }) {
    const normalized = (verificationStatus || '').toUpperCase();
    if (!['APPROVED', 'REJECTED', 'PENDING'].includes(normalized)) {
      const err = new Error("Invalid verification status. Must be 'APPROVED', 'REJECTED', or 'PENDING'.");
      err.statusCode = 400;
      throw err;
    }

    if (normalized === 'REJECTED' && !rejectionReason) {
      const err = new Error('A rejection reason is required when rejecting a document.');
      err.statusCode = 400;
      throw err;
    }

    const doc = await documentRepository.findById(id);
    if (!doc) {
      const err = new Error(`Document '${id}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    return documentRepository.updateVerification(id, {
      verificationStatus: normalized,
      verifiedBy,
      rejectionReason: normalized === 'REJECTED' ? rejectionReason : '',
    });
  },

  /**
   * Log candidate / employee acknowledgement of a document
   */
  async acknowledgeDocument(id, { acknowledgedBy, ipAddress, userAgent }) {
    const doc = await documentRepository.findById(id);
    if (!doc) {
      const err = new Error(`Document '${id}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    return documentRepository.appendAcknowledgement(id, {
      acknowledgedBy,
      ipAddress,
      userAgent,
    });
  },

  /**
   * Upload a new version of an existing document
   */
  async createNewVersion(id, newVersionData) {
    return documentRepository.createNewVersion(id, newVersionData);
  },

  /**
   * Delete document
   */
  async deleteDocument(id) {
    const deleted = await documentRepository.delete(id);
    if (!deleted) {
      const err = new Error(`Document '${id}' not found.`);
      err.statusCode = 404;
      throw err;
    }
    return { success: true, id };
  },
};

