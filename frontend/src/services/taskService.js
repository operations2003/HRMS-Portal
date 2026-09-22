import { http } from './api.js';

export const taskService = {
  getTasks: (params) => http.get('/v1/tasks', { params }),
  createTask: (data) => http.post('/v1/tasks', data),
  updateStatus: (id, status) => http.patch(`/v1/tasks/${id}/status`, { status }),
  addComment: (id, text) => http.post(`/v1/tasks/${id}/comments`, { text }),
  updateSubtasks: (id, subtasks) => http.patch(`/v1/tasks/${id}/subtasks`, { subtasks }),
  getMyPerformance: (params) => http.get('/v1/tasks/performance', { params }),
};

