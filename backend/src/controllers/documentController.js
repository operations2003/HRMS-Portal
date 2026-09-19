import fs from 'fs';
import path from 'path';
import { documentService } from '../services/documentService.js';
import { employeeRepository } from '../repositories/employeeRepository.js';
import { adminService } from '../services/adminService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const documentController = {
  /**
   * GET /api/v1/documents/:id/download
   * Authenticated, authorized document download & view stream
   */
  async downloadDocument(req, res, next) {
    try {
      const { id } = req.params;
      const doc = await documentService.getDocumentById(id);
      if (!doc) {
        return sendError(res, 'Document not found.', 404);
      }

      // Check authorization
      const isOwner = req.user.employeeId && doc.ownerId === req.user.employeeId;
      const isPrivileged = req.user.roleName && ['admin', 'superadmin', 'orgadmin', 'hr', 'hrmanager'].includes(req.user.roleName.toLowerCase());
      
      let isManagerOfOwner = false;
      if (!isOwner && !isPrivileged && req.user.employeeId && doc.ownerType === 'EMPLOYEE') {
        const ownerEmp = await employeeRepository.findById(doc.ownerId);
        if (ownerEmp && ownerEmp.managerId === req.user.employeeId) {
          isManagerOfOwner = true;
        }
      }

      if (!isOwner && !isPrivileged && !isManagerOfOwner) {
        return sendError(res, 'Access denied: You do not have permission to access this document.', 403);
      }

      // Log audit for document access
      try {
        await adminService.logAction({
          orgId: req.user.orgId,
          actorUserId: req.user.id,
          actorRole: req.user.roleName,
          targetType: 'DOCUMENT',
          targetId: doc.id,
          action: 'DOWNLOAD',
          details: { title: doc.title, documentType: doc.documentType },
          ipAddress: req.ip,
        });
      } catch (logErr) {
        // Non-blocking
      }

      // If document is stored locally
      if (doc.fileUrl) {
        const relativePath = doc.fileUrl.startsWith('/') ? doc.fileUrl.slice(1) : doc.fileUrl;
        const absolutePath = path.resolve(process.cwd(), relativePath);

        if (fs.existsSync(absolutePath)) {
          res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="${encodeURIComponent(doc.title || path.basename(absolutePath))}"`
          );
          return res.sendFile(absolutePath);
        }
      }

      return sendError(res, 'Document binary file not found on server storage.', 404);
    } catch (error) {
      next(error);
    }
  },
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
   * GET /api/v1/documents/my
   * Employee self-service: retrieve own documents from Document Vault (IDOR protected)
   */
  async getMyDocuments(req, res, next) {
    try {
      const orgId = req.user.orgId || 'org-1';
      const employee = await employeeRepository.findByUserId(req.user.id, orgId);
      if (!employee) {
        return sendSuccess(res, 'No employee record associated with this account.', []);
      }
      const docs = await documentService.getDocumentsByOwner('EMPLOYEE', employee.id);
      return sendSuccess(res, 'Your documents retrieved successfully.', docs);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/documents/my/upload
   * Employee self-service: upload compliance/identification document to Document Vault
   */
  async uploadMyDocument(req, res, next) {
    try {
      const orgId = req.user.orgId || 'org-1';
      const employee = await employeeRepository.findByUserId(req.user.id, orgId);
      if (!employee) {
        return sendError(res, 'No employee record found for your user account.', 404);
      }
      if (!req.file) {
        return sendError(res, 'No document file was uploaded.', 400);
      }

      const fileUrl = `/uploads/onboarding_documents/${req.file.filename}`;
      const payload = {
        orgId,
        ownerType: 'EMPLOYEE',
        ownerId: employee.id,
        category: req.body.category || 'OTHER',
        documentType: req.body.documentType || req.body.category || 'OTHER',
        title: req.body.title || req.file.originalname,
        fileUrl,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        verificationStatus: 'PENDING',
      };

      const doc = await documentService.addDocument(payload);
      return sendSuccess(res, 'Document uploaded to Document Vault successfully.', doc, null, 201);
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
      const isHrOrAdmin = ['Admin', 'SuperAdmin', 'HR', 'HRManager', 'OrgAdmin'].includes(req.user?.roleName);

      // IDOR Protection: Employees can only access their own documents
      if (!isHrOrAdmin && ownerType.toUpperCase() === 'EMPLOYEE') {
        const orgId = req.user.orgId || 'org-1';
        const employee = await employeeRepository.findByUserId(req.user.id, orgId);
        if (!employee || employee.id !== ownerId) {
          return sendError(res, 'Access Forbidden: You are not authorized to access documents of another employee.', 403);
        }
      }

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

      // IDOR Protection: If employee document, non-HR/Admin users can only view their own
      const isHrOrAdmin = ['Admin', 'SuperAdmin', 'HR', 'HRManager', 'OrgAdmin'].includes(req.user?.roleName);
      if (!isHrOrAdmin && doc.ownerType === 'EMPLOYEE') {
        const orgId = req.user.orgId || 'org-1';
        const employee = await employeeRepository.findByUserId(req.user.id, orgId);
        if (!employee || doc.ownerId !== employee.id) {
          return sendError(res, 'Access Forbidden: You cannot access documents of another employee.', 403);
        }
      }

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

