import { documentService } from '../services/documentService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const documentController = {
  /**
   * POST /api/v1/documents
   */
  async addDocument(req, res, next) {
    try {
      const payload = {
        ...req.body,
        orgId: req.body.orgId || (req.user && req.user.orgId),
      };

      const doc = await documentService.addDocument(payload);
      return sendSuccess(res, 'Document saved to Document Vault successfully.', doc, null, 201);
    } catch (error) {
      if (error.statusCode === 400) {
        return sendError(res, error.message, 400);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/documents/owner/:ownerType/:ownerId
   */
  async getDocumentsByOwner(req, res, next) {
    try {
      const { ownerType, ownerId } = req.params;
      const docs = await documentService.getDocumentsByOwner(ownerType, ownerId);
      return sendSuccess(res, 'Owner documents retrieved successfully.', docs);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/documents/:id
   */
  async getDocumentById(req, res, next) {
    try {
      const { id } = req.params;
      const doc = await documentService.getDocumentById(id);
      return sendSuccess(res, 'Document retrieved successfully.', doc);
    } catch (error) {
      if (error.statusCode === 404) {
        return sendError(res, error.message, 404);
      }
      next(error);
    }
  },

  /**
   * PATCH /api/v1/documents/:id/verify
   */
  async verifyDocument(req, res, next) {
    try {
      const { id } = req.params;
      const { verificationStatus, rejectionReason } = req.body;
      const verifiedBy = req.user ? req.user.id : null;

      const updated = await documentService.verifyDocument(id, {
        verificationStatus,
        verifiedBy,
        rejectionReason,
      });

      return sendSuccess(res, `Document verification status updated to '${verificationStatus}'.`, updated);
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 400) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * POST /api/v1/documents/:id/acknowledge
   */
  async acknowledgeDocument(req, res, next) {
    try {
      const { id } = req.params;
      const acknowledgedBy = req.user ? req.user.email || req.user.id : (req.body.acknowledgedBy || 'Candidate');
      const ipAddress = req.ip || req.connection.remoteAddress || '';
      const userAgent = req.headers['user-agent'] || '';

      const updated = await documentService.acknowledgeDocument(id, {
        acknowledgedBy,
        ipAddress,
        userAgent,
      });

      return sendSuccess(res, 'Document acknowledgement logged successfully.', updated);
    } catch (error) {
      if (error.statusCode === 404) {
        return sendError(res, error.message, 404);
      }
      next(error);
    }
  },

  /**
   * POST /api/v1/documents/:id/version
   */
  async createNewVersion(req, res, next) {
    try {
      const { id } = req.params;
      const newDoc = await documentService.createNewVersion(id, req.body);
      return sendSuccess(res, `New document version ${newDoc.version} created successfully.`, newDoc, null, 201);
    } catch (error) {
      if (error.statusCode === 404) {
        return sendError(res, error.message, 404);
      }
      next(error);
    }
  },

  /**
   * DELETE /api/v1/documents/:id
   */
  async deleteDocument(req, res, next) {
    try {
      const { id } = req.params;
      const result = await documentService.deleteDocument(id);
      return sendSuccess(res, 'Document removed from vault.', result);
    } catch (error) {
      if (error.statusCode === 404) {
        return sendError(res, error.message, 404);
      }
      next(error);
    }
  },
};

