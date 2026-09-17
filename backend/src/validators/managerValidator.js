/**
 * Validators for Manager and Team APIs
 */

export const validateAssignManager = (body = {}) => {
  const errors = [];

  if (!body.employeeId || typeof body.employeeId !== 'string' || !body.employeeId.trim()) {
    errors.push('Employee ID is required.');
  }

  // managerId can be null/empty if removing manager, but if provided must be string
  if (body.managerId !== null && body.managerId !== undefined && typeof body.managerId !== 'string') {
    errors.push('Manager ID must be a string or null.');
  }

  if (body.employeeId && body.managerId && body.employeeId === body.managerId) {
    errors.push('An employee cannot be assigned as their own manager.');
  }

  return errors;
};

export const validateEmployeeId = (id) => {
  if (!id || typeof id !== 'string' || !id.trim()) {
    return 'Employee ID is required.';
  }
  const clean = id.trim();
  if (clean.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(clean)) {
    return 'Invalid Employee ID format.';
  }
  return null;
};

export const validateLeaveAction = (body = {}) => {
  const errors = [];
  if (body.action && !['APPROVE', 'REJECT'].includes(body.action.toUpperCase())) {
    errors.push("Action must be either 'APPROVE' or 'REJECT'.");
  }
  if (body.action && body.action.toUpperCase() === 'REJECT' && (!body.rejectionReason || !body.rejectionReason.trim())) {
    errors.push('Rejection reason is mandatory when rejecting a leave request.');
  }
  return errors;
};
