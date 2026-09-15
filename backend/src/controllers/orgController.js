import { orgService } from '../services/orgService.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const orgController = {
  /**
   * GET /api/v1/organizations
   */
  async list(req, res, next) {
    try {
      const { search, status } = req.query;
      const orgs = await orgService.listOrganizations({ search, status });
      return sendSuccess(res, 'Organizations retrieved successfully.', orgs);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/organizations/:id
   */
  async getById(req, res, next) {
    try {
      const org = await orgService.getOrganizationById(req.params.id);
      return sendSuccess(res, 'Organization details retrieved.', org);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/organizations
   */
  async create(req, res, next) {
    try {
      const newOrg = await orgService.createOrganization(req.body);
      return sendSuccess(res, 'Organization created successfully.', newOrg, 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/v1/organizations/:id
   */
  async update(req, res, next) {
    try {
      const updated = await orgService.updateOrganization(req.params.id, req.body);
      return sendSuccess(res, 'Organization updated successfully.', updated);
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/v1/organizations/:id
   */
  async delete(req, res, next) {
    try {
      await orgService.deleteOrganization(req.params.id);
      return sendSuccess(res, 'Organization deleted successfully.', null);
    } catch (error) {
      next(error);
    }
  },
};
