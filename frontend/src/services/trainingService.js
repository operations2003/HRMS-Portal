import { http } from './api.js';

export const trainingService = {
  getCourses: (params) => http.get('/v1/training/courses', { params }),
  getCourseById: (id) => http.get(`/v1/training/courses/${id}`),
  createCourse: (data) => http.post('/v1/training/courses', data),
  updateCourse: (id, data) => http.put(`/v1/training/courses/${id}`, data),
  publishCourse: (id) => http.patch(`/v1/training/courses/${id}/publish`),
  unpublishCourse: (id) => http.patch(`/v1/training/courses/${id}/unpublish`),
  deleteCourse: (id) => http.delete(`/v1/training/courses/${id}`),
  getCourseProgress: (id) => http.get(`/v1/training/courses/${id}/progress`),
  getEnrollments: (params) => http.get('/v1/training/enrollments', { params }),
  enroll: (data) => http.post('/v1/training/enrollments', data),
  updateProgress: (id, data) => http.patch(`/v1/training/enrollments/${id}`, data),
  getSkills: (params) => http.get('/v1/training/skills', { params }),
  upsertSkill: (data) => http.post('/v1/training/skills', data),
};

