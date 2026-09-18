import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { validateLogin } from '../validators/authValidator.js';

const router = Router();

router.post('/login', validate(validateLogin), authController.login);
router.post('/logout', authController.logout);
router.get(['/me', '/profile'], authenticate, authController.getMe);

export default router;
