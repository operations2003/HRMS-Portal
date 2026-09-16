const VALID_REQUEST_TYPES = [
  'DOCUMENT_REQUEST',
  'HR_REQUEST',
  'PAYROLL_CLARIFICATION',
  'EMPLOYEE_SERVICE',
  'OTHER',
];

const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const VALID_STATUSES = ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CANCELLED'];

/**
 * Validate request creation payload
 */
export const validateCreateRequest = (body) => {
  const errors = [];

  if (!body.requestType || typeof body.requestType !== 'string' || !VALID_REQUEST_TYPES.includes(body.requestType.toUpperCase())) {
    errors.push(`Request type is required and must be one of: ${VALID_REQUEST_TYPES.join(', ')}.`);
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

  if (body.priority && !VALID_PRIORITIES.includes(body.priority.toUpperCase())) {
    errors.push(`Priority must be one of: ${VALID_PRIORITIES.join(', ')}.`);
  }

  return errors;
};

/**
 * Validate adding an update/message
 */
export const validateAddRequestUpdate = (body) => {
  const errors = [];

  if (!body.message || typeof body.message !== 'string' || !body.message.trim()) {
    errors.push('Message is required.');
  } else if (body.message.trim().length > 3000) {
    errors.push('Message must not exceed 3000 characters.');
  }

  return errors;
};

/**
 * Validate assign request
 */
export const validateAssignRequest = (body) => {
  const errors = [];

  if (!body.assignedTo && !body.assignedTeam) {
    errors.push('Either assignedTo (user ID) or assignedTeam is required.');
  }

  return errors;
};

/**
 * Validate status update
 */
export const validateUpdateRequestStatus = (body) => {
  const errors = [];

  if (!body.status || !VALID_STATUSES.includes(body.status.toUpperCase())) {
    errors.push(`Status is required and must be one of: ${VALID_STATUSES.join(', ')}.`);
  }

  return errors;
};

/**
 * Validate resolving request
 */
export const validateResolveRequest = (body) => {
  const errors = [];

  if (!body.responseNotes || typeof body.responseNotes !== 'string' || !body.responseNotes.trim()) {
    errors.push('Response notes are required to resolve the request.');
  } else if (body.responseNotes.trim().length < 3) {
    errors.push('Response notes must be at least 3 characters long.');
  }

  return errors;
};

/**
 * Validate rejecting request
 */
export const validateRejectRequest = (body) => {
  const errors = [];

  if (!body.rejectionReason || typeof body.rejectionReason !== 'string' || !body.rejectionReason.trim()) {
    errors.push('Rejection reason is required.');
  } else if (body.rejectionReason.trim().length < 3) {
    errors.push('Rejection reason must be at least 3 characters long.');
  }

  return errors;
};
