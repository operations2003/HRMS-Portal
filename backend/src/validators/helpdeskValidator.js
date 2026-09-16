const VALID_CATEGORIES = [
  'HR',
  'PAYROLL',
  'LEAVE_ATTENDANCE',
  'DOCUMENT',
  'IT_SUPPORT',
  'GENERAL',
  'OTHER',
];

const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const VALID_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED'];

/**
 * Validate ticket creation payload
 */
export const validateCreateTicket = (body) => {
  const errors = [];

  if (!body.category || typeof body.category !== 'string' || !VALID_CATEGORIES.includes(body.category.toUpperCase())) {
    errors.push(`Category is required and must be one of: ${VALID_CATEGORIES.join(', ')}.`);
  }

  if (!body.subject || typeof body.subject !== 'string' || !body.subject.trim()) {
    errors.push('Subject is required.');
  } else if (body.subject.trim().length < 3) {
    errors.push('Subject must be at least 3 characters long.');
  } else if (body.subject.trim().length > 255) {
    errors.push('Subject must not exceed 255 characters.');
  }

  if (!body.description || typeof body.description !== 'string' || !body.description.trim()) {
    errors.push('Description is required.');
  } else if (body.description.trim().length < 5) {
    errors.push('Description must be at least 5 characters long.');
  } else if (body.description.trim().length > 5000) {
    errors.push('Description must not exceed 5000 characters.');
  }

  if (body.priority && (!VALID_PRIORITIES.includes(body.priority.toUpperCase()))) {
    errors.push(`Priority must be one of: ${VALID_PRIORITIES.join(', ')}.`);
  }

  return errors;
};

/**
 * Validate adding a comment
 */
export const validateAddComment = (body) => {
  const errors = [];

  if (!body.comment || typeof body.comment !== 'string' || !body.comment.trim()) {
    errors.push('Comment text is required.');
  } else if (body.comment.trim().length > 3000) {
    errors.push('Comment must not exceed 3000 characters.');
  }

  return errors;
};

/**
 * Validate ticket assignment
 */
export const validateAssignTicket = (body) => {
  const errors = [];

  if (!body.assignedTo && !body.assignedTeam) {
    errors.push('Either assignedTo (user ID) or assignedTeam is required.');
  }

  return errors;
};

/**
 * Validate updating status
 */
export const validateUpdateStatus = (body) => {
  const errors = [];

  if (!body.status || !VALID_STATUSES.includes(body.status.toUpperCase())) {
    errors.push(`Status is required and must be one of: ${VALID_STATUSES.join(', ')}.`);
  }

  return errors;
};

/**
 * Validate resolving ticket
 */
export const validateResolveTicket = (body) => {
  const errors = [];

  if (!body.resolution || typeof body.resolution !== 'string' || !body.resolution.trim()) {
    errors.push('Resolution description is required to resolve a ticket.');
  } else if (body.resolution.trim().length < 3) {
    errors.push('Resolution must be at least 3 characters long.');
  }

  return errors;
};
