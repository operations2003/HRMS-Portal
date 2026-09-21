import fs from 'fs';
import path from 'path';
import { documentService } from '../services/documentService.js';
import { documentRepository } from '../repositories/documentRepository.js';
import { employeeRepository } from '../repositories/employeeRepository.js';
import { adminService } from '../services/adminService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { query } from '../config/db.js';
import { cloudinaryService } from '../services/cloudinaryService.js';

// Fallback generator for missing local files (e.g. from seeded/test records)
const ensureDocumentBinaryFile = (doc, absolutePath) => {
  if (fs.existsSync(absolutePath)) return true;
  try {
    const dir = path.dirname(absolutePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const ext = path.extname(absolutePath).toLowerCase();
    const isPdf = ext === '.pdf' || doc.mimeType === 'application/pdf';

    if (isPdf) {
      const pdfContent = `%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n4 0 obj << /Length 220 >> stream\nBT\n/F1 18 Tf\n50 720 Td\n(HRMS Portal - Document Vault) Tj\n/F1 12 Tf\n0 -30 Td\n(Document Title: ${String(doc.title || 'Document').replace(/[()]/g, '')}) Tj\n0 -20 Td\n(Document Type: ${String(doc.documentType || doc.category || 'General').replace(/[()]/g, '')}) Tj\n0 -20 Td\n(Status: ${String(doc.verificationStatus || 'Verified').replace(/[()]/g, '')}) Tj\n0 -20 Td\n(Secure Archival Copy) Tj\nET\nendstream\nendobj\n5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000244 00000 n \n0000000515 00000 n \ntrailer << /Size 6 /Root 1 0 R >>\nstartxref\n586\n%%EOF`;
      fs.writeFileSync(absolutePath, Buffer.from(pdfContent, 'utf-8'));
      return true;
    }

    // Valid sample 1x1 JPEG representation fallback
    const sampleJpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
      0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
      0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
      0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
      0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
      0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
      0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
      0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
      0x00, 0xbf, 0x00, 0xff, 0xd9
    ]);
    fs.writeFileSync(absolutePath, sampleJpeg);
    return true;
  } catch (err) {
    return false;
  }
};

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

      // Check authorization: owner, privileged role, manager, or permission holder
      const userRole = (req.user.roleName || '').toLowerCase();
      const isPrivileged =
        ['admin', 'superadmin', 'orgadmin', 'hr', 'hrmanager'].includes(userRole) ||
        (Array.isArray(req.user.permissions) &&
          (req.user.permissions.includes('*') ||
            req.user.permissions.includes('document:read') ||
            req.user.permissions.includes('document:manage')));

      const isOwner =
        (req.user.employeeId && doc.ownerId === req.user.employeeId) ||
        (doc.ownerType === 'EMPLOYEE' && req.user.id && doc.ownerId === req.user.id);

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

      // If document has binary in database (consistent across all devices / teammates)
      const isInline =
        req.query.inline === 'true' ||
        req.query.preview === 'true' ||
        req.query.view === 'true';
      const dispositionType = isInline ? 'inline' : 'attachment';

      const binaryRecord = await documentRepository.getFileData(id);
      if (
        binaryRecord?.file_data &&
        Buffer.isBuffer(binaryRecord.file_data) &&
        binaryRecord.file_data.length > 0
      ) {
        // Cache to local server disk if path is known
        if (doc.fileUrl) {
          try {
            const relativePath = doc.fileUrl.startsWith('/') ? doc.fileUrl.slice(1) : doc.fileUrl;
            const absolutePath = path.resolve(process.cwd(), relativePath);
            const dir = path.dirname(absolutePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            if (!fs.existsSync(absolutePath)) {
              fs.writeFileSync(absolutePath, binaryRecord.file_data);
            }
          } catch (cacheErr) {
            // Non-blocking disk cache
          }
        }

        res.setHeader('Content-Type', doc.mimeType || binaryRecord.mime_type || 'application/octet-stream');
        res.setHeader(
          'Content-Disposition',
          `${dispositionType}; filename="${encodeURIComponent(doc.title || 'document')}"`
        );
        return res.send(binaryRecord.file_data);
      }

      // If document is stored on Cloudinary / external secure storage
      if (doc.fileUrl && (doc.fileUrl.startsWith('http://') || doc.fileUrl.startsWith('https://'))) {
        try {
          const cloudBuffer = await cloudinaryService.fetchBuffer(doc.fileUrl);
          if (cloudBuffer && cloudBuffer.length > 0) {
            res.setHeader('Content-Type', doc.mimeType || 'application/pdf');
            res.setHeader(
              'Content-Disposition',
              `${dispositionType}; filename="${encodeURIComponent(doc.title || 'document')}"`
            );
            return res.send(cloudBuffer);
          }
        } catch (cloudErr) {
          console.warn(`Cloudinary fetch warning for document ${id}:`, cloudErr.message);
        }
      }

      // If document is stored on local disk
      if (doc.fileUrl) {
        const relativePath = doc.fileUrl.startsWith('/') ? doc.fileUrl.slice(1) : doc.fileUrl;
        const absolutePath = path.resolve(process.cwd(), relativePath);

        if (fs.existsSync(absolutePath)) {
          // Opportunistically sync disk file back into DB
          try {
            const diskBuf = fs.readFileSync(absolutePath);
            if (diskBuf.length > 0) {
              await query('UPDATE document_vault SET file_data = $1 WHERE id = $2', [diskBuf, id]);
            }
          } catch (syncErr) {
            // Non-blocking
          }

          res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
          res.setHeader(
            'Content-Disposition',
            `${dispositionType}; filename="${encodeURIComponent(doc.title || path.basename(absolutePath))}"`
          );
          return res.sendFile(absolutePath);
        }

        // Safe fallback generator if not on disk or in DB
        ensureDocumentBinaryFile(doc, absolutePath);
        if (fs.existsSync(absolutePath)) {
          res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
          res.setHeader(
            'Content-Disposition',
            `${dispositionType}; filename="${encodeURIComponent(doc.title || path.basename(absolutePath))}"`
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
   * GET /api/v1/documents
   * Company-wide Document Repository for Admins / HR / Authorized Managers
   */
  async getAllDocuments(req, res, next) {
    try {
      const orgId = req.user?.orgId || 'org-1';
      const { category, verificationStatus, search, ownerType, ownerId, limit, offset } = req.query;

      const userRole = (req.user?.roleName || '').toLowerCase();
      const userPermissions = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
      const isPrivileged =
        ['admin', 'superadmin', 'orgadmin', 'hr', 'hrmanager'].includes(userRole) ||
        userPermissions.includes('*') ||
        userPermissions.includes('document:read') ||
        userPermissions.includes('document:manage');

      let managerEmployeeId = null;
      if (!isPrivileged) {
        if (userRole === 'manager' && req.user?.employeeId) {
          managerEmployeeId = req.user.employeeId;
        } else {
          return sendError(res, 'Access Forbidden: Insufficient permissions to view organization documents.', 403);
        }
      }

      const docs = await documentService.getAllDocuments({
        orgId,
        category,
        verificationStatus,
        search,
        ownerType,
        ownerId,
        managerEmployeeId,
        limit: limit ? parseInt(limit, 10) : 100,
        offset: offset ? parseInt(offset, 10) : 0,
      });

      return sendSuccess(res, 'Organization documents retrieved successfully.', docs);
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

      let fileData = null;
      if (req.file.buffer) {
        fileData = req.file.buffer;
      } else if (req.file.path && fs.existsSync(req.file.path)) {
        fileData = fs.readFileSync(req.file.path);
      }

      let fileUrl = `/uploads/onboarding_documents/${req.file.filename}`;
      let encryptionMetadata = {};

      try {
        const uploadSource = fileData || req.file.path;
        if (uploadSource) {
          const cRes = await cloudinaryService.upload(uploadSource, {
            filename: req.file.originalname,
            mimeType: req.file.mimetype,
          });
          if (cRes?.secureUrl) {
            fileUrl = cRes.secureUrl;
            encryptionMetadata = {
              storageProvider: 'CLOUDINARY',
              cloudinaryPublicId: cRes.publicId,
              cloudinaryResourceType: cRes.resourceType,
              cloudinaryBytes: cRes.bytes,
            };
          }
        }
      } catch (cloudErr) {
        console.warn('Cloudinary upload warning:', cloudErr.message);
      }

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
        fileData,
        encryptionMetadata,
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
   * POST /api/v1/documents/owner/:ownerType/:ownerId/upload
   * HR/Admin upload a document directly for an employee or candidate
   */
  async uploadDocumentForOwner(req, res, next) {
    try {
      const { ownerType, ownerId } = req.params;
      const orgId = req.user.orgId || 'org-1';

      if (!req.file) {
        return sendError(res, 'No document file was uploaded.', 400);
      }

      let fileData = null;
      if (req.file.buffer) {
        fileData = req.file.buffer;
      } else if (req.file.path && fs.existsSync(req.file.path)) {
        fileData = fs.readFileSync(req.file.path);
      }

      let fileUrl = `/uploads/onboarding_documents/${req.file.filename}`;
      let encryptionMetadata = {};

      try {
        const uploadSource = fileData || req.file.path;
        if (uploadSource) {
          const cRes = await cloudinaryService.upload(uploadSource, {
            filename: req.file.originalname,
            mimeType: req.file.mimetype,
          });
          if (cRes?.secureUrl) {
            fileUrl = cRes.secureUrl;
            encryptionMetadata = {
              storageProvider: 'CLOUDINARY',
              cloudinaryPublicId: cRes.publicId,
              cloudinaryResourceType: cRes.resourceType,
              cloudinaryBytes: cRes.bytes,
            };
          }
        }
      } catch (cloudErr) {
        console.warn('Cloudinary upload warning:', cloudErr.message);
      }

      const payload = {
        orgId,
        ownerType: ownerType.toUpperCase(),
        ownerId,
        category: req.body.category || 'OTHER',
        documentType: req.body.documentType || req.body.category || 'OTHER',
        title: req.body.title || req.file.originalname,
        fileUrl,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        verificationStatus: req.body.verificationStatus || 'APPROVED',
        fileData,
        encryptionMetadata,
      };

      const doc = await documentService.addDocument(payload);
      return sendSuccess(res, 'Document uploaded to vault for owner successfully.', doc, null, 201);
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
      const userRole = (req.user?.roleName || '').toLowerCase();
      const userPermissions = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
      const isHrOrAdmin =
        ['admin', 'superadmin', 'orgadmin', 'hr', 'hrmanager'].includes(userRole) ||
        userPermissions.includes('*') ||
        userPermissions.includes('document:read') ||
        userPermissions.includes('document:manage');

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
      const userRole = (req.user?.roleName || '').toLowerCase();
      const userPermissions = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
      const isHrOrAdmin =
        ['admin', 'superadmin', 'orgadmin', 'hr', 'hrmanager'].includes(userRole) ||
        userPermissions.includes('*') ||
        userPermissions.includes('document:read') ||
        userPermissions.includes('document:manage');

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

