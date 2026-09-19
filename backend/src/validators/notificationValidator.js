const VALID_EVENT_TYPES = [
  'TICKET_CREATED',
  'TICKET_STATUS_CHANGED',
  'EMPLOYEE_REQUEST_CREATED',
  'EMPLOYEE_REQUEST_STATUS_CHANGED',
  'GENERAL_ALERT',
  // Phase 6 Domain Events
  'PERFORMANCE_REVIEW_PENDING',
  'PERFORMANCE_APPROVED',
  'PERFORMANCE_RETURNED',
  'PERFORMANCE_REJECTED',
  'LEAVE_APPROVAL_PENDING',
  'LEAVE_APPROVED',
  'LEAVE_REJECTED',
  'MANAGER_ASSIGNED',
];

/**
 * Validate system / custom notification dispatch payload
 */
export const validateCreateNotification = (body) => {
  const errors = [];

  if (!body.userId || typeof body.userId !== 'string' || !body.userId.trim()) {
    errors.push('Recipient userId is required.');
  }

  if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
    errors.push('Title is required.');
  } else if (body.title.trim().length > 255) {
    errors.push('Title must not exceed 255 characters.');
  }

  if (!body.message || typeof body.message !== 'string' || !body.message.trim()) {
    errors.push('Message is required.');
  } else if (body.message.trim().length > 2000) {
    errors.push('Message must not exceed 2000 characters.');
  }

  if (body.eventType && !VALID_EVENT_TYPES.includes(body.eventType.toUpperCase())) {
    errors.push(`Event type must be one of: ${VALID_EVENT_TYPES.join(', ')}.`);
  }

  return errors;
};
