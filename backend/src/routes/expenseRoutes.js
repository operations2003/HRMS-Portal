import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { sendError } from '../utils/apiResponse.js';

const router = Router();

router.use(authenticate);

// Deactivated by requirement: Expense page removed, backend returns 403 Forbidden
router.all('*', (req, res) => {
  return sendError(res, 'Expense module is deactivated', 403);
});

export default router;
