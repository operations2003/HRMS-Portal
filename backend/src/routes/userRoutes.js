import { Router } from 'express';
import { userController } from '../controllers/userController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/rbacMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { validateCreateUser } from '../validators/userValidator.js';

const router = Router();

// All user routes require authentication
router.use(authenticate);

router.get('/meta/roles', authorize(['user:read', 'user:write']), userController.getRoles);
router.get('/', authorize('user:read'), userController.list);
router.get('/:id', authorize('user:read'), userController.getById);
router.post('/', authorize('user:write'), validate(validateCreateUser), userController.create);
router.put('/:id', authorize('user:write'), userController.update);

export default router;
