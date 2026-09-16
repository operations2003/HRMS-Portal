export const validateChecklistUpdate = (body) => {
  const errors = [];
  if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
    errors.push('At least one checklist item update must be provided in request body.');
    return errors;
  }

  // Validate that any passed boolean flags are actually booleans
  const booleanKeys = [
    'itSetup',
    'workstationReady',
    'welcomeKitDispatched',
    'idCardGenerated',
    'orientationScheduled',
  ];

  let hasValidField = false;
  for (const [key, value] of Object.entries(body)) {
    if (booleanKeys.includes(key)) {
      if (typeof value !== 'boolean') {
        errors.push(`Checklist item '${key}' must be a boolean (true/false).`);
      } else {
        hasValidField = true;
      }
    } else if (typeof value === 'boolean') {
      // Allow custom dynamic checklist boolean keys
      hasValidField = true;
    }
  }

  if (!hasValidField && errors.length === 0) {
    errors.push(`Request must contain at least one valid checklist boolean field (${booleanKeys.join(', ')}).`);
  }

  return errors;
};

export const validateReadinessUpdate = (body) => {
  return validateChecklistUpdate(body);
};

export const validateItSetupUpdate = (body) => {
  const errors = [];
  if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
    errors.push('IT Setup update payload cannot be empty.');
    return errors;
  }

  if (body.workEmail && typeof body.workEmail === 'string') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.workEmail.trim())) {
      errors.push('workEmail must be a valid email address.');
    }
  }

  if (body.emailProvisioned !== undefined && typeof body.emailProvisioned !== 'boolean') {
    errors.push('emailProvisioned must be a boolean value.');
  }

  if (body.hardwareAssigned !== undefined && typeof body.hardwareAssigned !== 'boolean') {
    errors.push('hardwareAssigned must be a boolean value.');
  }

  if (body.status !== undefined) {
    const allowedStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED'];
    if (!allowedStatuses.includes(String(body.status).toUpperCase().trim())) {
      errors.push(`Invalid IT setup status. Allowed values: ${allowedStatuses.join(', ')}`);
    }
  }

  if (body.systemAccess !== undefined && !Array.isArray(body.systemAccess) && typeof body.systemAccess !== 'object') {
    errors.push('systemAccess must be an array or object containing access permissions.');
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
      errors.push('Salary must be a non-negative number.');
    }
  }

  if (body.dateOfJoining !== undefined && body.dateOfJoining !== null && body.dateOfJoining !== '') {
    if (typeof body.dateOfJoining !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.dateOfJoining.trim())) {
      errors.push('Date of joining must follow YYYY-MM-DD format.');
    }
  }

  return errors;
};
