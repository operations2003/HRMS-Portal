import { authService } from '../services/authService.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const authController = {
  /**
   * POST /api/v1/auth/login
   */
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);
      return sendSuccess(res, 'Login successful.', result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/auth/logout
   */
  async logout(req, res) {
    // JWT is stateless; client removes token. We return clean logout confirmation.
    return sendSuccess(res, 'Logged out successfully.', null);
  },

  /**
   * GET /api/v1/auth/me
   */
  async getMe(req, res, next) {
    try {
      const profile = await authService.getProfile(req.user.id);
      return sendSuccess(res, 'User profile retrieved.', profile);
    } catch (error) {
      next(error);
    }
  },
};
