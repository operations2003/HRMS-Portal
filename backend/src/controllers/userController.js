import { userService } from '../services/userService.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const userController = {
  /**
   * GET /api/v1/users
   */
  async list(req, res, next) {
    try {
      const users = await userService.listUsers();
      return sendSuccess(res, 'Users retrieved successfully.', users);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/users/:id
   */
  async getById(req, res, next) {
    try {
      const user = await userService.getUserById(req.params.id);
      return sendSuccess(res, 'User details retrieved.', user);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/users
   */
  async create(req, res, next) {
    try {
      const newUser = await userService.createUser(req.body);
      return sendSuccess(res, 'User created successfully.', newUser, 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/v1/users/:id
   */
  async update(req, res, next) {
    try {
      const updated = await userService.updateUser(req.params.id, req.body);
      return sendSuccess(res, 'User updated successfully.', updated);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/users/meta/roles
   */
  async getRoles(req, res, next) {
    try {
      const roles = await userService.getRoles();
      return sendSuccess(res, 'Roles retrieved.', roles);
    } catch (error) {
      next(error);
    }
  },
};
