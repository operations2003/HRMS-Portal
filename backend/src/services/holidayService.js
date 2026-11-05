import { holidayRepository } from '../repositories/holidayRepository.js';
import { isCeoOrAdmin } from '../utils/roleUtils.js';

export const holidayService = {
  /**
   * Helper to verify administrative permissions
   */
  assertAdmin(currentUser) {
    const role = (currentUser?.roleName || '').toLowerCase().trim();
    const email = (currentUser?.email || '').toLowerCase().trim();
    const isAdmin =
      isCeoOrAdmin(currentUser) ||
      ['admin', 'superadmin', 'orgadmin', 'ceo'].includes(role) ||
      email === 'sheetalbedi@tasknera.com' ||
      email === 'ceo@tasknera.com';
    if (!isAdmin) {
      const err = new Error('Access Forbidden: Only Administrators and CEO can manage company holidays.');
      err.statusCode = 403;
      throw err;
    }
  },

  /**
   * List company holidays
   */
  async listHolidays(currentUser, filters = {}) {
    const orgId = currentUser?.orgId || 'org-1';
    return holidayRepository.findAll(orgId, filters);
  },

  /**
   * Declare / create a new company holiday
   */
  async createHoliday(currentUser, payload = {}) {
    this.assertAdmin(currentUser);
    const orgId = currentUser?.orgId || 'org-1';

    const {
      name,
      holidayDate,
      holidayType = 'COMPANY',
      isOptional = false,
      description = '',
      status = 'Active',
    } = payload;

    if (!name || !name.trim()) {
      const err = new Error('Holiday name / title is required.');
      err.statusCode = 400;
      throw err;
    }

    if (!holidayDate || !/^\d{4}-\d{2}-\d{2}$/.test(holidayDate.trim())) {
      const err = new Error('A valid holiday date in YYYY-MM-DD format is required.');
      err.statusCode = 400;
      throw err;
    }

    const validTypes = ['COMPANY', 'NATIONAL', 'REGIONAL', 'OPTIONAL'];
    const normalizedType = validTypes.includes((holidayType || '').toUpperCase())
      ? (holidayType || '').toUpperCase()
      : 'COMPANY';

    return holidayRepository.upsertHoliday({
      orgId,
      name: name.trim(),
      holidayDate: holidayDate.trim(),
      holidayType: normalizedType,
      isOptional: Boolean(isOptional),
      description: (description || '').trim(),
      status: status === 'Inactive' ? 'Inactive' : 'Active',
    });
  },

  /**
   * Update holiday
   */
  async updateHoliday(currentUser, id, payload = {}) {
    this.assertAdmin(currentUser);
    const orgId = currentUser?.orgId || 'org-1';

    const existing = await holidayRepository.findById(id, orgId);
    if (!existing) {
      const err = new Error('Holiday not found.');
      err.statusCode = 404;
      throw err;
    }

    const updates = {};
    if (payload.name !== undefined) updates.name = payload.name.trim();
    if (payload.holidayDate !== undefined) updates.holidayDate = payload.holidayDate.trim();
    if (payload.holidayType !== undefined) {
      const validTypes = ['COMPANY', 'NATIONAL', 'REGIONAL', 'OPTIONAL'];
      updates.holidayType = validTypes.includes(payload.holidayType.toUpperCase())
        ? payload.holidayType.toUpperCase()
        : 'COMPANY';
    }
    if (payload.isOptional !== undefined) updates.isOptional = Boolean(payload.isOptional);
    if (payload.description !== undefined) updates.description = payload.description.trim();
    if (payload.status !== undefined) {
      updates.status = payload.status === 'Inactive' ? 'Inactive' : 'Active';
    }

    return holidayRepository.updateHoliday(id, orgId, updates);
  },

  /**
   * Delete / remove holiday
   */
  async deleteHoliday(currentUser, id) {
    this.assertAdmin(currentUser);
    const orgId = currentUser?.orgId || 'org-1';

    const existing = await holidayRepository.findById(id, orgId);
    if (!existing) {
      const err = new Error('Holiday not found.');
      err.statusCode = 404;
      throw err;
    }

    return holidayRepository.delete(id, orgId);
  },
};

