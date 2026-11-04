import { http } from './api.js';

export const taskService = {
  getTasks: (params) => http.get('/v1/tasks', { params }),
  createTask: (data) => http.post('/v1/tasks', data),
  deleteTask: (id) => http.delete(`/v1/tasks/${id}`),
  updateStatus: (id, status) => http.patch(`/v1/tasks/${id}/status`, { status }),
  addComment: (id, text) => http.post(`/v1/tasks/${id}/comments`, { text }),
  updateSubtasks: (id, subtasks) => http.patch(`/v1/tasks/${id}/subtasks`, { subtasks }),
  rateTask: (id, data) => http.patch(`/v1/tasks/${id}/rate`, data),
  reopenTask: (id, data) => http.patch(`/v1/tasks/${id}/reopen`, data),
  getMyPerformance: (params) => http.get('/v1/tasks/performance', { params }),
  reassignTask: (id, data) => http.patch(`/v1/tasks/${id}/reassign`, data),
  updateProgress: (id, data) => http.patch(`/v1/tasks/${id}/progress`, data),
  requestExtension: (id, data) => http.post(`/v1/tasks/${id}/extension-request`, data),
  getAuditTrail: (id) => http.get(`/v1/tasks/${id}/audit-trail`),
};
