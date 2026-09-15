import { Router } from 'express';
import { userController } from '../controllers/userController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/rbacMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { validateCreateUser } from '../validators/userValidator.js';

const router = Router();

// Middleware: Strictly enforce that only Admin can create users or modify user roles
const requireAdmin = (req, res, next) => {
  const role = (req.user?.roleName || '').toLowerCase();
  if (role !== 'admin' && role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only Admins are authorized to add users and assign roles.',
      errors: ['Insufficient role privileges.'],
    });
  }
  next();
};

// All user routes require authentication
router.use(authenticate);

router.get('/meta/roles', authorize(['user:read', 'user:write']), userController.getRoles);
router.get('/', authorize('user:read'), userController.list);
router.get('/:id', authorize('user:read'), userController.getById);
router.post('/', requireAdmin, validate(validateCreateUser), userController.create);
router.put('/:id', requireAdmin, userController.update);

export default router;
