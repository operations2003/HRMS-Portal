import { Router } from 'express';
import { orgController } from '../controllers/orgController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/rbacMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { validateCreateOrg, validateUpdateOrg } from '../validators/orgValidator.js';

const router = Router();

// All organization routes require authentication
router.use(authenticate);

router.get('/', authorize('org:read'), orgController.list);
router.get('/:id', authorize('org:read'), orgController.getById);
router.post('/', authorize('org:write'), validate(validateCreateOrg), orgController.create);
router.put('/:id', authorize('org:write'), validate(validateUpdateOrg), orgController.update);
router.delete('/:id', authorize('org:delete'), orgController.delete);

export default router;
