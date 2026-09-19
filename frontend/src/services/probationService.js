import { http } from './api.js';

export const probationService = {
  getProbations: (params) => http.get('/v1/probation', { params }),
  submitEvaluation: (employeeId, data) => http.post(`/v1/probation/${employeeId}/evaluate`, data),
  hrReview: (employeeId, data) => http.post(`/v1/probation/${employeeId}/review`, data),
};

