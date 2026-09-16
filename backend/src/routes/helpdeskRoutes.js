import { Router } from 'express';
import { helpdeskController } from '../controllers/helpdeskController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/rbacMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
  validateCreateTicket,
  validateAddComment,
  validateAssignTicket,
  validateUpdateStatus,
  validateResolveTicket,
} from '../validators/helpdeskValidator.js';

const router = Router();

// Authentication required for all helpdesk routes
router.use(authenticate);

// =====================================================================
// 1. Employee Own Tickets (Self-Service with IDOR Guard)
// =====================================================================
router.get('/my/tickets', authorize('helpdesk:read'), helpdeskController.getMyTickets);
router.post(
  '/tickets',
  authorize('helpdesk:write'),
  validate(validateCreateTicket),
  helpdeskController.createTicket
);
router.post(
  '/tickets/:id/comments',
  authorize('helpdesk:write'),
  validate(validateAddComment),
  helpdeskController.addComment
);
router.post(
  '/tickets/:id/cancel',
  authorize('helpdesk:write'),
  helpdeskController.cancelTicket
);

// =====================================================================
// 2. Ticket Retrieval & Metrics
// =====================================================================
router.get('/stats', authorize('helpdesk:read'), helpdeskController.getStats);
router.get('/tickets', authorize('helpdesk:read'), helpdeskController.listTickets);
router.get('/tickets/:id', authorize('helpdesk:read'), helpdeskController.getTicketById);

// =====================================================================
// 3. HR / Admin / Support Ticket Management
// =====================================================================
router.post(
  '/tickets/:id/assign',
  authorize('helpdesk:manage'),
  validate(validateAssignTicket),
  helpdeskController.assignTicket
);
router.patch(
  '/tickets/:id/status',
  authorize('helpdesk:manage'),
  validate(validateUpdateStatus),
  helpdeskController.updateStatus
);
router.post(
  '/tickets/:id/resolve',
  authorize('helpdesk:manage'),
  validate(validateResolveTicket),
  helpdeskController.resolveTicket
);
router.post(
  '/tickets/:id/close',
  authorize('helpdesk:manage'),
  helpdeskController.closeTicket
);

export default router;
