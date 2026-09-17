/**
 * Validators for Manager and Team APIs
 */

export const validateAssignManager = (body) => {
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
