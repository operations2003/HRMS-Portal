import { Router } from 'express';
import { employeeController } from '../controllers/employeeController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/rbacMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { validateCreateEmployee, validateUpdateEmployee } from '../validators/employeeValidator.js';
import { uploadSingleDocument } from '../middleware/uploadMiddleware.js';

const router = Router();

// All employee routes require authentication
router.use(authenticate);

router.get('/metadata', authorize(['employee:read', 'employee:write']), employeeController.getMetadata);
router.get('/me/profile', employeeController.getMyProfile);
router.put('/me/profile', employeeController.updateMyProfile);
router.post('/me/avatar', uploadSingleDocument('avatar'), employeeController.uploadAvatar);
router.delete('/me/avatar', employeeController.removeAvatar);
router.get('/:id/profile', employeeController.getProfileById);
router.post('/:id/avatar', authorize('employee:write'), uploadSingleDocument('avatar'), employeeController.uploadAvatarForEmployee);
router.delete('/:id/avatar', authorize('employee:write'), employeeController.removeAvatarForEmployee);
router.get('/', authorize('employee:read'), employeeController.list);
router.get('/:id', authorize('employee:read'), employeeController.getById);
router.get('/:id/timeline', authorize('employee:read'), employeeController.getTimeline);
router.post('/', authorize('employee:write'), validate(validateCreateEmployee), employeeController.create);
router.put('/:id', authorize('employee:write'), validate(validateUpdateEmployee), employeeController.update);
router.delete('/:id', authorize('employee:delete'), employeeController.delete);

export default router;
