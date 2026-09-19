import { http } from './api.js';

export const trainingService = {
  getCourses: (params) => http.get('/v1/training/courses', { params }),
  createCourse: (data) => http.post('/v1/training/courses', data),
  getEnrollments: (params) => http.get('/v1/training/enrollments', { params }),
  enroll: (data) => http.post('/v1/training/enrollments', data),
  updateProgress: (id, data) => http.patch(`/v1/training/enrollments/${id}`, data),
  getSkills: (params) => http.get('/v1/training/skills', { params }),
  upsertSkill: (data) => http.post('/v1/training/skills', data),
};

