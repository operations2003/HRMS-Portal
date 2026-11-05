import { holidayService } from '../services/holidayService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const holidayController = {
  async list(req, res, next) {
    try {
      const { year, status } = req.query;
      const holidays = await holidayService.listHolidays(req.user, { year, status });
      return sendSuccess(res, 'Holidays retrieved successfully.', holidays);
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const holiday = await holidayService.createHoliday(req.user, req.body);
      return sendSuccess(res, 'Company holiday declared successfully.', holiday, 201);
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const updated = await holidayService.updateHoliday(req.user, req.params.id, req.body);
      return sendSuccess(res, 'Company holiday updated successfully.', updated);
    } catch (err) {
      next(err);
    }
  },

  async delete(req, res, next) {
    try {
      await holidayService.deleteHoliday(req.user, req.params.id);
      return sendSuccess(res, 'Company holiday removed successfully.');
    } catch (err) {
      next(err);
    }
  },
};

