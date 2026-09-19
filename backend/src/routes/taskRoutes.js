import { Router } from 'express';
import { taskController } from '../controllers/taskController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/rbacMiddleware.js';

const router = Router();

router.use(authenticate);

router.get('/', authorize(['task:read', 'employee:read']), taskController.list);
router.post('/', authorize(['task:write', 'employee:read']), taskController.create);
router.patch('/:id/status', authorize(['task:write', 'employee:read']), taskController.updateStatus);
router.post('/:id/comments', authorize(['task:write', 'employee:read']), taskController.addComment);
router.patch('/:id/subtasks', authorize(['task:write', 'employee:read']), taskController.updateSubtasks);

export default router;

