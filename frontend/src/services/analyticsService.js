import { http } from './api.js';

export const analyticsService = {
  getWorkforceAnalytics: () => http.get('/v1/analytics/workforce'),
};

