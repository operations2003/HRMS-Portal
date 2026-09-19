import { engagementService } from '../services/engagementService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const engagementController = {
  // Announcements
  async listAnnouncements(req, res, next) {
    try {
      const orgId = req.user.orgId || 'org-1';
      const list = await engagementService.listAnnouncements(orgId, req.user);
      return sendSuccess(res, 'Announcements retrieved.', list);
    } catch (error) {
      next(error);
    }
  },

  async createAnnouncement(req, res, next) {
    try {
      const orgId = req.user.orgId || 'org-1';
      const created = await engagementService.createAnnouncement(orgId, req.user, req.body);
      return sendSuccess(res, 'Announcement published successfully.', created, null, 201);
    } catch (error) {
      next(error);
    }
  },

  async markAsRead(req, res, next) {
    try {
      const { id } = req.params;
      const result = await engagementService.markAsRead(id, req.user);
      return sendSuccess(res, 'Marked as read.', result);
    } catch (error) {
      next(error);
    }
  },

  // Surveys
  async listSurveys(req, res, next) {
    try {
      const orgId = req.user.orgId || 'org-1';
      const surveys = await engagementService.listSurveys(orgId, req.user);
      return sendSuccess(res, 'Surveys retrieved.', surveys);
    } catch (error) {
      next(error);
    }
  },

  async createSurvey(req, res, next) {
    try {
      const orgId = req.user.orgId || 'org-1';
      const survey = await engagementService.createSurvey(orgId, req.user, req.body);
      return sendSuccess(res, 'Survey created successfully.', survey, null, 201);
    } catch (error) {
      next(error);
    }
  },

  async submitSurveyResponse(req, res, next) {
    try {
      const { id } = req.params;
      const response = await engagementService.submitSurveyResponse(id, req.user, req.body);
      return sendSuccess(res, 'Survey response submitted successfully.', response);
    } catch (error) {
      next(error);
    }
  },

  // Recognitions
  async listRecognitions(req, res, next) {
    try {
      const orgId = req.user.orgId || 'org-1';
      const recognitions = await engagementService.listRecognitions(orgId);
      return sendSuccess(res, 'Recognitions retrieved.', recognitions);
    } catch (error) {
      next(error);
    }
  },

  async giveRecognition(req, res, next) {
    try {
      const orgId = req.user.orgId || 'org-1';
      const recog = await engagementService.giveRecognition(orgId, req.user, req.body);
      return sendSuccess(res, 'Recognition posted successfully.', recog, null, 201);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },
};

