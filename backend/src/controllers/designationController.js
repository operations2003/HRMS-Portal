import { designationRepository } from '../repositories/designationRepository.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const designationController = {
  /**
   * GET /api/v1/designations
   * List all designations
   */
  async listDesignations(req, res, next) {
    try {
      const orgId = req.user?.orgId || 'org-1';
      const designations = await designationRepository.findAll(orgId);
      return sendSuccess(res, 'Designations retrieved successfully.', designations);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/designations/:id
   */
  async getDesignationById(req, res, next) {
    try {
      const orgId = req.user?.orgId || 'org-1';
      const designation = await designationRepository.findById(req.params.id, orgId);
      if (!designation) {
        return sendError(res, 'Designation not found.', 404);
      }
      return sendSuccess(res, 'Designation retrieved successfully.', designation);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/designations
   * Create a new designation
   */
  async createDesignation(req, res, next) {
    try {
      const orgId = req.user?.orgId || 'org-1';
      const { title, code, status } = req.body;

      if (!title || typeof title !== 'string' || !title.trim()) {
        return sendError(res, 'Designation title is required.', 400);
      }

      // Generate a default code if not provided
      let finalCode = code && typeof code === 'string' && code.trim() ? code.trim().toUpperCase() : '';
      if (!finalCode) {
        finalCode = title.trim().toUpperCase().replace(/[^A-Z0-9]/g, '-').slice(0, 10);
      }

      const existing = await designationRepository.findByCode(finalCode, orgId);
      if (existing) {
        return sendError(res, `Designation with code "${finalCode}" already exists.`, 409);
      }

      const created = await designationRepository.create({
        orgId,
        title: title.trim(),
        code: finalCode,
        status: status || 'Active',
      });

      return sendSuccess(res, 'Designation created successfully.', created, 201);
    } catch (error) {
      if (error.code === '23505') {
        return sendError(res, 'A designation with this code already exists.', 409);
      }
      next(error);
    }
  },

  /**
   * PUT /api/v1/designations/:id
   */
  async updateDesignation(req, res, next) {
    try {
      const orgId = req.user?.orgId || 'org-1';
      const { id } = req.params;
      const { title, code, status } = req.body;

      const existing = await designationRepository.findById(id, orgId);
      if (!existing) {
        return sendError(res, 'Designation not found.', 404);
      }

      if (code && code.trim().toUpperCase() !== existing.code) {
        const duplicate = await designationRepository.findByCode(code.trim(), orgId);
        if (duplicate && duplicate.id !== id) {
          return sendError(res, `Designation with code "${code.trim().toUpperCase()}" already exists.`, 409);
        }
      }

      const updated = await designationRepository.update(id, orgId, {
        title,
        code,
        status,
      });

      return sendSuccess(res, 'Designation updated successfully.', updated);
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/v1/designations/:id
   */
  async deleteDesignation(req, res, next) {
    try {
      const orgId = req.user?.orgId || 'org-1';
      const { id } = req.params;

      const existing = await designationRepository.findById(id, orgId);
      if (!existing) {
        return sendError(res, 'Designation not found.', 404);
      }

      await designationRepository.delete(id, orgId);
      return sendSuccess(res, 'Designation deleted successfully.', { id });
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },
};
