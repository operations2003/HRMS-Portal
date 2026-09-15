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

    return await orgRepository.create(data);
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

    return await orgRepository.update(id, data);
  },

  async deleteOrganization(id) {
    const existing = await orgRepository.findById(id);
    if (!existing) {
      const error = new Error(`Organization with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    return await orgRepository.delete(id);
  },
};
