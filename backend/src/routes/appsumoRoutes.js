import { Router } from 'express';
import { appsumoController } from '../controllers/appsumoController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRoles } from '../middleware/rbacMiddleware.js';
import { verifyToken } from '../utils/tokenUtils.js';
import { userRepository } from '../repositories/userRepository.js';

const router = Router();

/**
 * Optional authentication helper:
 * Attaches req.user if valid Bearer token is provided, without failing if absent.
 */
const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);
      const user = await userRepository.findById(decoded.id);
      if (user && user.status === 'Active') {
        req.user = {
          id: user.id,
          email: user.email,
          orgId: user.orgId,
          roleId: user.roleId,
          roleName: user.roleName,
        };
      }
    }
  } catch {
    // Continue without attached user
  }
  next();
};

// =========================================================================
// 1. AppSumo Public Webhook & OAuth Endpoints
// =========================================================================

// POST /api/v1/appsumo/webhook
router.post('/webhook', appsumoController.handleWebhook);

// POST /api/v1/appsumo/oauth/exchange
router.post('/oauth/exchange', appsumoController.exchangeOAuthCode);

// POST /api/v1/appsumo/activate (supports logged-in or guest signup/login)
router.post('/activate', optionalAuthenticate, appsumoController.activateLicense);

// =========================================================================
// 2. Organization Entitlement Check
// =========================================================================

// GET /api/v1/appsumo/entitlement
router.get('/entitlement', authenticate, appsumoController.getEntitlement);

// =========================================================================
// 3. SuperAdmin / Admin Support & Audit Registry
// =========================================================================

// GET /api/v1/appsumo/admin/licenses
router.get(
  '/admin/licenses',
  authenticate,
  requireRoles(['Admin', 'SuperAdmin', 'OrgAdmin']),
  appsumoController.listAdminLicenses
);

// GET /api/v1/appsumo/admin/licenses/:licenseKey
router.get(
  '/admin/licenses/:licenseKey',
  authenticate,
  requireRoles(['Admin', 'SuperAdmin', 'OrgAdmin']),
  appsumoController.getAdminLicenseDetail
);

export default router;
