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
  assignCourse: (courseId, data) => http.post(`/v1/training/courses/${courseId}/assign`, data),
  assignCourseBulk: (data) => http.post('/v1/training/assign', data),
  getEnrollments: (params) => http.get('/v1/training/enrollments', { params }),
  enroll: (data) => http.post('/v1/training/enrollments', data),
  updateProgress: (id, data) => http.patch(`/v1/training/enrollments/${id}`, data),
  getSkills: (params) => http.get('/v1/training/skills', { params }),
  upsertSkill: (data) => http.post('/v1/training/skills', data),
  getCertificates: (params) => http.get('/v1/training/certificates', { params }),
  uploadCertificate: (data) => {
    if (data instanceof FormData) {
      return http.upload('/v1/training/certificates', data);
    }
    return http.post('/v1/training/certificates', data);
  },
  deleteCertificate: (id) => http.delete(`/v1/training/certificates/${id}`),
};

