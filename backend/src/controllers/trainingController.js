import { trainingService } from '../services/trainingService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { canManageTraining } from '../middleware/rbacMiddleware.js';

export const trainingController = {
  /**
   * GET /api/v1/training/courses
   * - L&D Training Managers see all courses (published, draft, unpublished)
   * - Normal staff see only published/active courses
   */
  async listCourses(req, res, next) {
    try {
      const orgId = req.user.orgId || 'org-1';
      const isManager = canManageTraining(req.user);
      const courses = await trainingService.listCourses(orgId, req.query, isManager);
      return sendSuccess(res, 'Course catalogue retrieved.', courses);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/training/courses/:id
   */
  async getCourseById(req, res, next) {
    try {
      const orgId = req.user.orgId || 'org-1';
      const course = await trainingService.getCourseById(req.params.id, orgId);
      return sendSuccess(res, 'Course details retrieved.', course);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  /**
   * POST /api/v1/training/courses
   * Only Admin OR (HR AND Learning & Development)
   */
  async createCourse(req, res, next) {
    try {
      const orgId = req.user.orgId || 'org-1';
      const course = await trainingService.createCourse(orgId, req.user, req.body);
      return sendSuccess(res, 'Course created successfully.', course, null, 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/v1/training/courses/:id
   * Edit course
   */
  async updateCourse(req, res, next) {
    try {
      const { id } = req.params;
      const orgId = req.user.orgId || 'org-1';
      const updated = await trainingService.updateCourse(id, orgId, req.user, req.body);
      return sendSuccess(res, 'Course updated successfully.', updated);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  /**
   * PATCH /api/v1/training/courses/:id/publish
   */
  async publishCourse(req, res, next) {
    try {
      const { id } = req.params;
      const orgId = req.user.orgId || 'org-1';
      const published = await trainingService.publishCourse(id, orgId, req.user);
      return sendSuccess(res, 'Course published successfully.', published);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  /**
   * PATCH /api/v1/training/courses/:id/unpublish
   */
  async unpublishCourse(req, res, next) {
    try {
      const { id } = req.params;
      const orgId = req.user.orgId || 'org-1';
      const unpublished = await trainingService.unpublishCourse(id, orgId, req.user);
      return sendSuccess(res, 'Course unpublished successfully.', unpublished);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  /**
   * DELETE /api/v1/training/courses/:id
   */
  async deleteCourse(req, res, next) {
    try {
      const { id } = req.params;
      const orgId = req.user.orgId || 'org-1';
      const result = await trainingService.deleteCourse(id, orgId, req.user);
      return sendSuccess(res, 'Course deleted successfully.', result);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  /**
   * GET /api/v1/training/courses/:id/progress
   * Detailed completion matrix for a course
   */
  async getCourseCompletionMatrix(req, res, next) {
    try {
      const { id } = req.params;
      const orgId = req.user.orgId || 'org-1';
      const matrix = await trainingService.getCourseCompletionMatrix(orgId, id);
      return sendSuccess(res, 'Training completion matrix retrieved.', matrix);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  /**
   * GET /api/v1/training/enrollments
   * - Admin OR (HR AND L&D) can see all employees' completion data
   * - All other HR, managers, and employees only see their own enrollments
   */
  async listEnrollments(req, res, next) {
    try {
      const orgId = req.user.orgId || 'org-1';
      const filters = { ...req.query };
      
      const isManager = canManageTraining(req.user);
      if (!isManager) {
        // Enforce strictly own employee ID for all non-L&D users
        filters.employeeId = req.user.employeeId || 'none';
      }

      const enrollments = await trainingService.listEnrollments(orgId, filters);
      return sendSuccess(res, 'Enrollment records retrieved.', enrollments);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/training/enrollments
   */
  async enroll(req, res, next) {
    try {
      const orgId = req.user.orgId || 'org-1';
      const enrollment = await trainingService.enroll(orgId, req.user, req.body);
      return sendSuccess(res, 'Course enrollment recorded.', enrollment, null, 201);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  /**
   * PATCH /api/v1/training/enrollments/:id
   */
  async updateProgress(req, res, next) {
    try {
      const { id } = req.params;
      const orgId = req.user.orgId || 'org-1';
      const updated = await trainingService.updateProgress(id, orgId, req.user, req.body);
      return sendSuccess(res, 'Training progress updated.', updated);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  /**
   * GET /api/v1/training/skills
   */
  async getSkillMatrix(req, res, next) {
    try {
      const orgId = req.user.orgId || 'org-1';
      const isManager = canManageTraining(req.user);
      const employeeId = req.query.employeeId || (!isManager ? req.user.employeeId : null);
      const skills = await trainingService.getSkillMatrix(orgId, employeeId);
      return sendSuccess(res, 'Employee skill matrix retrieved.', skills);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/training/skills
   */
  async upsertSkill(req, res, next) {
    try {
      const orgId = req.user.orgId || 'org-1';
      const skill = await trainingService.upsertSkill(orgId, req.user, req.body);
      return sendSuccess(res, 'Skill recorded successfully.', skill);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },
};
