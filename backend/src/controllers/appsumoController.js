import { appsumoService } from '../services/appsumoService.js';
import { authService } from '../services/authService.js';
import { orgRepository } from '../repositories/orgRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { roleRepository } from '../repositories/roleRepository.js';
import { hashPassword } from '../utils/passwordUtils.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const appsumoController = {
  /**
   * POST /api/v1/appsumo/webhook
   * Public webhook endpoint for AppSumo Licensing API v2 events.
   *
   * Must return HTTP 200 with:
   * { "event": "<received_event>", "success": true }
   */
  async handleWebhook(req, res, next) {
    try {
      // Handle partner portal "Validate" button pings or empty ping requests
      const isValidatePing =
        !req.body ||
        Object.keys(req.body).length === 0 ||
        req.body.action === 'ping' ||
        req.body.action === 'validate' ||
        req.body.event === 'ping';

      if (isValidatePing) {
        return res.status(200).json({
          event: 'ping',
          success: true,
          message: 'AppSumo Webhook endpoint is active and listening.',
        });
      }

      const rawBody = req.rawBody || JSON.stringify(req.body);
      const result = await appsumoService.processWebhookEvent({
        payload: req.body,
        rawBody,
        headers: req.headers,
      });

      return res.status(200).json({
        event: result.event,
        success: true,
      });
    } catch (err) {
      console.error('[AppSumo Webhook Controller Error]:', err.message);
      // If signature verification or parsing failed, return 401 or 400
      const statusCode = err.statusCode || 400;
      return res.status(statusCode).json({
        event: req.body?.event || 'unknown',
        success: false,
        error: err.message,
      });
    }
  },

  /**
   * POST /api/v1/appsumo/oauth/exchange
   * Public endpoint to exchange single-use authorization code from ?code=...
   */
  async exchangeOAuthCode(req, res, next) {
    try {
      const { code, redirectUri } = req.body;
      if (!code) {
        return sendError(res, 'Authorization code is required.', 400);
      }

      const result = await appsumoService.exchangeCodeForLicense(code, redirectUri);
      return sendSuccess(res, 'AppSumo authorization code successfully exchanged.', result);
    } catch (err) {
      if (err.statusCode) {
        return sendError(res, err.message, err.statusCode);
      }
      next(err);
    }
  },

  /**
   * POST /api/v1/appsumo/activate
   * Connects and links an AppSumo license to a TaskNera organization.
   *
   * Supports:
   * 1. Authenticated user (links to req.user.orgId)
   * 2. Existing user login & link
   * 3. New customer organization creation & link
   */
  async activateLicense(req, res, next) {
    try {
      const {
        licenseKey,
        mode = 'authenticated', // 'authenticated' | 'login' | 'signup'
        // If mode === 'login'
        email,
        password,
        // If mode === 'signup'
        companyName,
        firstName,
        lastName,
        signupEmail,
        signupPassword,
      } = req.body;

      if (!licenseKey) {
        return sendError(res, 'License key is required.', 400);
      }

      let targetOrgId = null;
      let targetUserId = null;
      let authSession = null;

      if (req.user) {
        // Option A: Already authenticated in current session
        targetOrgId = req.user.orgId;
        targetUserId = req.user.id;
      } else if (mode === 'login') {
        // Option B: User provides existing TaskNera credentials
        if (!email || !password) {
          return sendError(res, 'Email and password are required to link existing account.', 400);
        }

        const loginResult = await authService.login(email, password);
        targetOrgId = loginResult.user.orgId;
        targetUserId = loginResult.user.id;
        authSession = loginResult;
      } else if (mode === 'signup') {
        // Option C: New customer signup
        const cleanEmail = (signupEmail || '').trim().toLowerCase();
        if (!cleanEmail || !signupPassword || !companyName) {
          return sendError(res, 'Company name, email, and password are required for signup.', 400);
        }

        // Check duplicate user email
        const existing = await userRepository.findByEmail(cleanEmail);
        if (existing) {
          return sendError(res, 'An account with this email already exists. Please log in to link your license.', 409);
        }

        // Create organization
        const orgCode = companyName
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .slice(0, 10) || `ORG${Date.now().toString().slice(-4)}`;

        const newOrg = await orgRepository.create({
          name: companyName.trim(),
          code: `${orgCode}-${Math.floor(Math.random() * 1000)}`,
          email: cleanEmail,
          status: 'Active',
        });

        // Resolve Admin role
        const roles = await roleRepository.findAll();
        const adminRole =
          roles.find((r) => r.name.toLowerCase() === 'admin' || r.name.toLowerCase() === 'orgadmin') || roles[0];

        // Create owner user
        const hashedPassword = await hashPassword(signupPassword);
        const newUser = await userRepository.create({
          orgId: newOrg.id,
          roleId: adminRole.id,
          email: cleanEmail,
          passwordHash: hashedPassword,
          firstName: (firstName || 'Admin').trim(),
          lastName: (lastName || 'User').trim(),
          status: 'Active',
        });

        targetOrgId = newOrg.id;
        targetUserId = newUser.id;

        // Automatically log in
        authSession = await authService.login(cleanEmail, signupPassword);
      } else {
        return sendError(res, 'Please log in or create an account to activate your license.', 401);
      }

      // Link AppSumo license to organization
      const linked = await appsumoService.linkLicenseToOrganization({
        licenseKey,
        organizationId: targetOrgId,
        userId: targetUserId,
      });

      return sendSuccess(res, 'Your AppSumo license has been activated successfully.', {
        license: linked,
        organizationId: targetOrgId,
        authSession,
      });
    } catch (err) {
      if (err.statusCode) {
        return sendError(res, err.message, err.statusCode);
      }
      next(err);
    }
  },

  /**
   * GET /api/v1/appsumo/entitlement
   * Returns current active AppSumo entitlement for the authenticated user's organization.
   */
  async getEntitlement(req, res, next) {
    try {
      const orgId = req.user.orgId;
      const entitlement = await appsumoService.getOrganizationEntitlement(orgId);
      return sendSuccess(res, 'Organization AppSumo entitlement retrieved.', entitlement);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/v1/appsumo/admin/licenses
   * SuperAdmin / Admin license registry inspection.
   */
  async listAdminLicenses(req, res, next) {
    try {
      const { search, status, tier, limit, offset } = req.query;
      const result = await appsumoService.listAllLicenses({
        search,
        status,
        tier,
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
      });
      return sendSuccess(res, 'AppSumo licenses retrieved successfully.', result);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/v1/appsumo/admin/licenses/:licenseKey
   * SuperAdmin / Admin view license details & event audit history.
   */
  async getAdminLicenseDetail(req, res, next) {
    try {
      const { licenseKey } = req.params;
      const details = await appsumoService.getLicenseDetails(licenseKey);
      return sendSuccess(res, 'AppSumo license details retrieved.', details);
    } catch (err) {
      if (err.statusCode) {
        return sendError(res, err.message, err.statusCode);
      }
      next(err);
    }
  },
};
