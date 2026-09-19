import { http } from './api.js';

export const engagementService = {
  getAnnouncements: () => http.get('/v1/engagement/announcements'),
  createAnnouncement: (data) => http.post('/v1/engagement/announcements', data),
  markAsRead: (id) => http.post(`/v1/engagement/announcements/${id}/read`),

  getSurveys: () => http.get('/v1/engagement/surveys'),
  createSurvey: (data) => http.post('/v1/engagement/surveys', data),
  submitSurveyResponse: (id, answers) => http.post(`/v1/engagement/surveys/${id}/respond`, { answers }),

  getRecognitions: () => http.get('/v1/engagement/recognitions'),
  giveRecognition: (data) => http.post('/v1/engagement/recognitions', data),
};

