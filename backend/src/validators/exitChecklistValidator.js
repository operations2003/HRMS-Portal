/**
 * Input validators for the Simple Exit Checklist feature
 */

const isValidDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(dateStr.slice(0, 10));
};

export const validateInitiateExitChecklist = (body) => {
  const errors = [];

  if (!body.employeeId || typeof body.employeeId !== 'string' || !body.employeeId.trim()) {
    errors.push('Employee selection (employeeId) is required.');
  }

  if (!body.resignationDate) {
    errors.push('Resignation date (resignationDate) is required.');
  } else if (!isValidDate(body.resignationDate)) {
    errors.push('Resignation date must be a valid date in YYYY-MM-DD format.');
  }

  if (!body.lastWorkingDay) {
    errors.push('Last working day (lastWorkingDay) is required.');
  } else if (!isValidDate(body.lastWorkingDay)) {
    errors.push('Last working day must be a valid date in YYYY-MM-DD format.');
  }

  if (body.resignationDate && body.lastWorkingDay && isValidDate(body.resignationDate) && isValidDate(body.lastWorkingDay)) {
    const resDate = new Date(body.resignationDate);
    const lwd = new Date(body.lastWorkingDay);
    if (lwd < resDate) {
      errors.push('Last working day cannot be earlier than resignation date.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const validateUpdateItemStatus = (body) => {
  const errors = [];
  const allowedStatuses = ['Pending', 'Completed'];

  if (!body.status || typeof body.status !== 'string') {
    errors.push(`Status is required and must be either 'Pending' or 'Completed'.`);
  } else {
    const formatted = body.status.charAt(0).toUpperCase() + body.status.slice(1).toLowerCase();
    if (!allowedStatuses.includes(formatted)) {
      errors.push(`Status must be either 'Pending' or 'Completed'. Provided: '${body.status}'.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
