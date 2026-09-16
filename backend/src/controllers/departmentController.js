import { departmentRepository } from '../repositories/departmentRepository.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const departmentController = {
  /**
   * GET /api/v1/departments
   * List all departments for user's organization
   */
  async listDepartments(req, res, next) {
    try {
      const orgId = req.user?.orgId || 'org-1';
      const departments = await departmentRepository.findAll(orgId);
      return sendSuccess(res, 'Departments retrieved successfully.', departments);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/departments/:id
   * Get single department by ID
   */
  async getDepartmentById(req, res, next) {
    try {
      const orgId = req.user?.orgId || 'org-1';
      const department = await departmentRepository.findById(req.params.id, orgId);
      if (!department) {
        return sendError(res, 'Department not found.', 404);
      }
      return sendSuccess(res, 'Department retrieved successfully.', department);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/departments
   * Create a new department
   */
  async createDepartment(req, res, next) {
    try {
      const orgId = req.user?.orgId || 'org-1';
      const { name, code, description, status } = req.body;

      if (!name || typeof name !== 'string' || !name.trim()) {
        return sendError(res, 'Department name is required.', 400);
      }
      if (!code || typeof code !== 'string' || !code.trim()) {
        return sendError(res, 'Department code is required.', 400);
      }

      const existing = await departmentRepository.findByCode(code.trim(), orgId);
      if (existing) {
        return sendError(res, `Department with code "${code.trim().toUpperCase()}" already exists.`, 409);
      }

      const created = await departmentRepository.create({
        orgId,
        name: name.trim(),
        code: code.trim(),
        description: description?.trim() || '',
        status: status || 'Active',
      });

      return sendSuccess(res, 'Department created successfully.', created, 201);
    } catch (error) {
      if (error.code === '23505') {
        return sendError(res, 'A department with this code already exists.', 409);
      }
      next(error);
    }
  },

  /**
   * PUT /api/v1/departments/:id
   * Update existing department
   */
  async updateDepartment(req, res, next) {
    try {
      const orgId = req.user?.orgId || 'org-1';
      const { id } = req.params;
      const { name, code, description, status } = req.body;

      const existing = await departmentRepository.findById(id, orgId);
      if (!existing) {
        return sendError(res, 'Department not found.', 404);
      }

      if (code && code.trim().toUpperCase() !== existing.code) {
        const duplicate = await departmentRepository.findByCode(code.trim(), orgId);
        if (duplicate && duplicate.id !== id) {
          return sendError(res, `Department with code "${code.trim().toUpperCase()}" already exists.`, 409);
        }
      }

      const updated = await departmentRepository.update(id, orgId, {
        name,
        code,
        description,
        status,
      });

      return sendSuccess(res, 'Department updated successfully.', updated);
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/v1/departments/:id
   * Delete department
   */
  async deleteDepartment(req, res, next) {
    try {
      const orgId = req.user?.orgId || 'org-1';
      const { id } = req.params;

      const existing = await departmentRepository.findById(id, orgId);
      if (!existing) {
        return sendError(res, 'Department not found.', 404);
      }

      await departmentRepository.delete(id, orgId);
      return sendSuccess(res, 'Department deleted successfully.', { id });
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },
};
