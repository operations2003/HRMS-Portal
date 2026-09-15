import { orgRepository } from '../repositories/orgRepository.js';

export const orgService = {
  async listOrganizations(filters) {
    return await orgRepository.findAll(filters);
  },

  async getOrganizationById(id) {
    const org = await orgRepository.findById(id);
    if (!org) {
      const error = new Error(`Organization with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }
    return org;
  },

  async createOrganization(data) {
    const existing = await orgRepository.findByCode(data.code);
    if (existing) {
      const error = new Error(`Organization code '${data.code.toUpperCase()}' is already in use.`);
      error.statusCode = 409;
      throw error;
    }

    try {
      return await orgRepository.create(data);
    } catch (dbError) {
      if (dbError.code === '23505') {
        const error = new Error(`Organization code '${data.code.toUpperCase()}' is already in use.`);
        error.statusCode = 409;
        throw error;
      }
      throw dbError;
    }
  },

  async updateOrganization(id, data) {
    const existing = await orgRepository.findById(id);
    if (!existing) {
      const error = new Error(`Organization with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    if (data.code && data.code.toUpperCase() !== existing.code.toUpperCase()) {
      const codeTaken = await orgRepository.findByCode(data.code);
      if (codeTaken && codeTaken.id !== id) {
        const error = new Error(`Organization code '${data.code.toUpperCase()}' is already taken.`);
        error.statusCode = 409;
        throw error;
      }
    }

    try {
      return await orgRepository.update(id, data);
    } catch (dbError) {
      if (dbError.code === '23505') {
        const error = new Error(`Organization code '${data.code.toUpperCase()}' is already taken.`);
        error.statusCode = 409;
        throw error;
      }
      throw dbError;
    }
  },

  async deleteOrganization(id) {
    const existing = await orgRepository.findById(id);
    if (!existing) {
      const error = new Error(`Organization with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    try {
      return await orgRepository.delete(id);
    } catch (dbError) {
      if (dbError.code === '23503') {
        const error = new Error(
          'Cannot delete organization with active departments or employees. Please deactivate the organization instead.'
        );
        error.statusCode = 400;
        throw error;
      }
      throw dbError;
    }
  },
};
