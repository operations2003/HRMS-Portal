import { http } from './api.js';

export const expenseService = {
  getExpenses: (params) => http.get('/v1/expenses', { params }),
  submitClaim: (data) => http.post('/v1/expenses', data),
  reviewClaim: (id, data) => http.patch(`/v1/expenses/${id}/review`, data),
};

