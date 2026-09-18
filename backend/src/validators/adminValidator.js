/**
 * Input validators for Phase 7 Admin and RBAC APIs
 */

export const validateCreateAdminUser = (body) => {
  const errors = [];

  if (!body.firstName || typeof body.firstName !== 'string' || !body.firstName.trim()) {
    errors.push('First name is required.');
  }

  if (!body.lastName || typeof body.lastName !== 'string' || !body.lastName.trim()) {
    errors.push('Last name is required.');
  }

  if (!body.email || typeof body.email !== 'string' || !body.email.trim()) {
    errors.push('Email is required.');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    errors.push('Please enter a valid email address.');
  }

  if (!body.password || typeof body.password !== 'string' || body.password.length < 6) {
    errors.push('Password must be at least 6 characters long.');
  }

  if (!body.roleId || typeof body.roleId !== 'string' || !body.roleId.trim()) {
    errors.push('Role selection is required.');
  }

  return errors;
};

export const validateUpdateAdminUser = (body) => {
  const errors = [];

  if (body.email !== undefined) {
    if (typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
      errors.push('Please enter a valid email address.');
    }
  }

  if (body.password !== undefined) {
    if (typeof body.password !== 'string' || body.password.length < 6) {
      errors.push('Password must be at least 6 characters long.');
    }
  }

  if (body.status !== undefined) {
    const validStatuses = ['Active', 'Inactive', 'Suspended'];
    if (!validStatuses.includes(body.status)) {
      errors.push(`Status must be one of: ${validStatuses.join(', ')}.`);
    }
  }

  return errors;
};

export const validateSetUserStatus = (body) => {
  const errors = [];
  const validStatuses = ['Active', 'Inactive', 'Suspended'];

  if (!body.status || typeof body.status !== 'string' || !validStatuses.includes(body.status)) {
    errors.push(`Valid status is required (${validStatuses.join(', ')}).`);
  }

  return errors;
};

export const validateAssignRole = (body) => {
  const errors = [];

  if (!body.roleId || typeof body.roleId !== 'string' || !body.roleId.trim()) {
    errors.push('roleId is required.');
  }

  return errors;
};

export const validateCreateRole = (body) => {
  const errors = [];

  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    errors.push('Role name is required.');
  } else if (body.name.trim().length < 2) {
    errors.push('Role name must be at least 2 characters long.');
  } else if (body.name.trim().length > 50) {
    errors.push('Role name must not exceed 50 characters.');
  }

  if (body.permissions !== undefined && !Array.isArray(body.permissions)) {
    errors.push('Permissions must be an array of permission IDs or codes.');
  }

  return errors;
};

export const validateUpdateRole = (body) => {
  const errors = [];

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length < 2) {
      errors.push('Role name must be at least 2 characters long.');
    }
  }

  if (body.status !== undefined) {
    const validStatuses = ['Active', 'Inactive'];
    if (!validStatuses.includes(body.status)) {
      errors.push(`Status must be one of: ${validStatuses.join(', ')}.`);
    }
  }

  return errors;
};

export const validateAssignPermissions = (body) => {
  const errors = [];

  if (!body.permissions || !Array.isArray(body.permissions)) {
    errors.push('A permissions array of permission IDs or codes is required.');
  }

  return errors;
};

export const validateUpdateConfig = (body) => {
  const errors = [];

  if (!body.configKey || typeof body.configKey !== 'string' || !body.configKey.trim()) {
    errors.push('configKey is required.');
  }

  if (body.configValue === undefined || body.configValue === null) {
    errors.push('configValue is required.');
  }

  if (body.category !== undefined) {
    const validCats = ['EXIT_OFFBOARDING', 'SECURITY_RBAC', 'PAYROLL', 'GENERAL'];
    if (!validCats.includes(body.category)) {
      errors.push(`Category must be one of: ${validCats.join(', ')}.`);
    }
  }

  return errors;
};
