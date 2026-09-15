export const validateReadinessUpdate = (body) => {
  const errors = [];
  const keys = ['itSetup', 'workstationReady', 'welcomeKitDispatched', 'idCardGenerated', 'orientationScheduled'];
  const hasAtLeastOne = keys.some((k) => typeof body[k] === 'boolean');

  if (!hasAtLeastOne) {
    errors.push(`At least one checklist item must be provided as a boolean (${keys.join(', ')}).`);
  }

  return errors;
};

export const validateBgvUpdate = (body) => {
  const errors = [];
  const allowed = ['PENDING', 'INITIATED', 'IN_PROGRESS', 'CLEAR', 'RED_FLAG', 'WAIVED'];

  if (!body.bgvStatus || typeof body.bgvStatus !== 'string' || !body.bgvStatus.trim()) {
    errors.push('bgvStatus is required.');
  } else if (!allowed.includes(body.bgvStatus.trim().toUpperCase())) {
    errors.push(`Invalid bgvStatus. Allowed values: ${allowed.join(', ')}`);
  }

  return errors;
};

export const validateConvertToEmployee = (body) => {
  const errors = [];

  if (body.salary !== undefined && body.salary !== null && body.salary !== '') {
    if (isNaN(Number(body.salary)) || Number(body.salary) < 0) {
      errors.push('Salary must be a positive number.');
    }
  }

  if (body.dateOfJoining !== undefined && body.dateOfJoining !== null && body.dateOfJoining !== '') {
    if (typeof body.dateOfJoining !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.dateOfJoining.trim())) {
      errors.push('Date of joining must follow YYYY-MM-DD format.');
    }
  }

  return errors;
};

