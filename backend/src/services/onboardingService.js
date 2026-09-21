import fs from 'fs';
import { newHireRepository } from '../repositories/newHireRepository.js';
import { documentRepository } from '../repositories/documentRepository.js';
import { documentService } from './documentService.js';
import { cloudinaryService } from './cloudinaryService.js';
import { logger } from '../utils/logger.js';

export const onboardingService = {
  /**
   * List new hires with advanced filtering & pagination
   */
  async getNewHires(filter, pagination) {
    return newHireRepository.findAll({ ...filter, ...pagination });
  },

  /**
   * Get single new hire details including attached documents
   */
  async getNewHireById(id) {
    const newHire = await newHireRepository.findById(id);
    if (!newHire) {
      const err = new Error(`New Hire record '${id}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    const documents = await documentRepository.findByOwner('NEW_HIRE', id);
    return {
      ...newHire,
      documents,
    };
  },

  /**
   * Fetch structured onboarding status (Checklist, Documents, IT Setup, BGV)
   */
  async getOnboardingStatus(id) {
    const newHire = await newHireRepository.findById(id);
    if (!newHire) {
      const err = new Error(`New Hire record '${id}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    const documents = await documentRepository.findByOwner('NEW_HIRE', id);

    const approvedCount = documents.filter((d) => d.verificationStatus === 'APPROVED').length;
    const pendingCount = documents.filter((d) => d.verificationStatus === 'PENDING').length;
    const rejectedCount = documents.filter((d) => d.verificationStatus === 'REJECTED').length;

    const checklist = newHire.readinessTracker || {};
    const itSetup = newHire.itSetup || {};
    const isBgvClear = newHire.bgvStatus === 'CLEAR' || newHire.bgvStatus === 'WAIVED';

    const readyForDayOne =
      (checklist.completionPercentage === 100 || newHire.onboardingStatus === 'READY_FOR_JOINING') &&
      isBgvClear;

    return {
      id: newHire.id,
      atsCandidateId: newHire.atsCandidateId,
      fullName: newHire.fullName,
      email: newHire.email,
      dateOfJoining: newHire.dateOfJoining,
      lifecycleState: newHire.lifecycleState,
      onboardingStatus: newHire.onboardingStatus,
      employeeId: newHire.employeeId,
      readyForDayOne,
      department: newHire.department,
      designation: newHire.designation,
      manager: newHire.manager,
      checklist: {
        ...checklist,
        completionPercentage: checklist.completionPercentage || 0,
      },
      documentStatus: {
        total: documents.length,
        approved: approvedCount,
        pending: pendingCount,
        rejected: rejectedCount,
        allApproved: documents.length > 0 && pendingCount === 0 && rejectedCount === 0,
        documents,
      },
      itSetup: {
        ...itSetup,
        isProvisioned: itSetup.status === 'COMPLETED' || itSetup.emailProvisioned,
      },
      bgv: {
        status: newHire.bgvStatus,
        isClear: isBgvClear,
        updatedAt: newHire.updatedAt,
      },
    };
  },

  /**
   * Update individual workflow checklist items
   */
  async updateChecklist(id, updates) {
    const updated = await newHireRepository.updateChecklist(id, updates);
    if (!updated) {
      const err = new Error(`New Hire record '${id}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    logger.info('ONBOARDING', `Checklist updated for candidate ${id}`, {
      updates,
      completionPercentage: updated.readinessTracker?.completionPercentage,
    });

    return updated;
  },

  /**
   * Fetch IT Provisioning state
   */
  async getItSetup(id) {
    const itSetup = await newHireRepository.getItSetup(id);
    if (!itSetup) {
      const err = new Error(`New Hire record '${id}' not found.`);
      err.statusCode = 404;
      throw err;
    }
    return itSetup;
  },

  /**
   * Update IT Provisioning status
   */
  async updateItSetup(id, itData, user = null) {
    const updatedBy = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'IT Admin';
    const updated = await newHireRepository.updateItSetup(id, itData, updatedBy);
    if (!updated) {
      const err = new Error(`New Hire record '${id}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    logger.info('IT-SETUP', `IT setup updated for candidate ${id}`, {
      status: updated.status,
      emailProvisioned: updated.emailProvisioned,
      updatedBy,
    });

    return updated;
  },

  /**
   * Upload Document directly to Document Vault for a New Hire
   */
  async uploadDocument(newHireId, file, metadata = {}, user = null) {
    const newHire = await newHireRepository.findById(newHireId);
    if (!newHire) {
      const err = new Error(`New Hire record '${newHireId}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    let fileUrl = `/uploads/onboarding_documents/${file.filename}`;
    const category = (metadata.category || 'IDENTITY').toUpperCase();
    const documentType = (metadata.documentType || 'OTHER').toUpperCase();
    const title = metadata.title || file.originalname;

    let fileData = null;
    if (file.buffer) {
      fileData = file.buffer;
    } else if (file.path && fs.existsSync(file.path)) {
      fileData = fs.readFileSync(file.path);
    }

    let encryptionMetadata = {};
    try {
      const uploadSource = fileData || file.path;
      if (uploadSource) {
        const cRes = await cloudinaryService.upload(uploadSource, {
          filename: file.originalname,
          mimeType: file.mimetype,
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
      logger.warn('OnboardingService', `Cloudinary upload warning: ${cloudErr.message}`);
    }

    const docRecord = await documentRepository.create({
      orgId: newHire.orgId,
      ownerType: 'NEW_HIRE',
      ownerId: newHireId,
      category,
      documentType,
      title,
      fileUrl,
      fileSize: file.size,
      mimeType: file.mimetype,
      verificationStatus: 'PENDING',
      fileData,
      encryptionMetadata,
    });

    logger.info('DOC-UPLOAD', `Document '${title}' uploaded for candidate ${newHireId}`, {
      docId: docRecord.id,
      fileSize: file.size,
      mimeType: file.mimetype,
    });

    return docRecord;
  },

  /**
   * Verify document in Document Vault (Approve/Reject)
   */
  async verifyDocument(docId, { verificationStatus, rejectionReason }, user = null) {
    const verifiedBy = user ? user.id : null;
    const verified = await documentService.verifyDocument(docId, {
      verificationStatus,
      verifiedBy,
      rejectionReason,
    });

    logger.info('DOC-VERIFY', `Document ${docId} verified as ${verificationStatus}`, {
      verifiedBy: user ? user.email : 'System',
    });

    return verified;
  },

  /**
   * Day-1 conversion logic linking new hire to Employee Master without creating duplicate profiles
   */
  async convertToEmployee(id, employeeOverrides = {}) {
    const existing = await newHireRepository.findById(id);
    if (!existing) {
      const err = new Error(`New Hire record '${id}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    if (existing.lifecycleState === 'CONVERTED_TO_EMPLOYEE') {
      const err = new Error(`Candidate is already converted to Employee (Employee ID: ${existing.employeeId}).`);
      err.statusCode = 400;
      throw err;
    }

    if (existing.bgvStatus === 'RED_FLAG') {
      const err = new Error('Cannot convert candidate to Employee: Background Verification is marked RED_FLAG.');
      err.statusCode = 400;
      throw err;
    }

    const result = await newHireRepository.convertToEmployee(id, employeeOverrides);
    const updatedNewHire = await newHireRepository.findById(id);

    const message = result.isExistingProfileLinked
      ? `Candidate ${existing.fullName} successfully linked to existing active Employee Master profile (${result.employeeCode}) without duplication.`
      : `Candidate ${existing.fullName} converted to new Employee (${result.employeeCode}) successfully.`;

    logger.info('CONVERT-EMP', message, {
      newHireId: id,
      employeeId: result.employeeId,
      employeeCode: result.employeeCode,
      isExistingProfileLinked: result.isExistingProfileLinked,
    });

    return {
      message,
      isExistingProfileLinked: result.isExistingProfileLinked,
      employeeId: result.employeeId,
      employeeCode: result.employeeCode,
      employee: result.employee,
      newHire: updatedNewHire,
    };
  },

  /**
   * Update Background Verification Status
   */
  async updateBgvStatus(id, bgvStatus) {
    const allowed = ['PENDING', 'INITIATED', 'IN_PROGRESS', 'CLEAR', 'RED_FLAG', 'WAIVED'];
    const normalized = (bgvStatus || '').toUpperCase().trim();
    if (!allowed.includes(normalized)) {
      const err = new Error(`Invalid BGV status '${bgvStatus}'. Allowed: ${allowed.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }

    const existing = await newHireRepository.findById(id);
    if (!existing) {
      const err = new Error(`New Hire record '${id}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    return newHireRepository.updateLifecycleState(id, { bgvStatus: normalized });
  },

  /**
   * Transition: NEW_HIRE -> ONBOARDING
   */
  async initiateOnboarding(id) {
    const existing = await newHireRepository.findById(id);
    if (!existing) {
      const err = new Error(`New Hire record '${id}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    if (existing.lifecycleState === 'CONVERTED_TO_EMPLOYEE') {
      const err = new Error('Candidate is already converted to an active Employee.');
      err.statusCode = 400;
      throw err;
    }

    return newHireRepository.updateLifecycleState(id, {
      lifecycleState: 'ONBOARDING',
      onboardingStatus: 'IN_PROGRESS',
      bgvStatus: existing.bgvStatus === 'PENDING' ? 'INITIATED' : existing.bgvStatus,
    });
  },
};
