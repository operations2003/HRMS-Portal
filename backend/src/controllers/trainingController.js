import { trainingService } from '../services/trainingService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const trainingController = {
  /**
   * GET /api/v1/training/courses
   */
  async listCourses(req, res, next) {
    try {
      const orgId = req.user.orgId || 'org-1';
      const courses = await trainingService.listCourses(orgId, req.query);
      return sendSuccess(res, 'Course catalogue retrieved.', courses);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/training/courses
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
   * GET /api/v1/training/enrollments
   */
  async listEnrollments(req, res, next) {
    try {
      const orgId = req.user.orgId || 'org-1';
      const filters = { ...req.query };
      
      // If employee role, restrict to own enrollments
      const isPrivileged = req.user.roleName && ['admin', 'superadmin', 'orgadmin', 'hr', 'hrmanager', 'manager'].includes(req.user.roleName.toLowerCase());
      if (!isPrivileged && req.user.employeeId) {
        filters.employeeId = req.user.employeeId;
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
      const employeeId = req.query.employeeId || (!['admin', 'hr', 'manager'].includes((req.user.roleName || '').toLowerCase()) ? req.user.employeeId : null);
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

