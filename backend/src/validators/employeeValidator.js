export const validateCreateEmployee = (body) => {
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

  if (!body.orgId || typeof body.orgId !== 'string' || !body.orgId.trim()) {
    errors.push('Organization selection is required.');
  }

  if (body.salary !== undefined && body.salary !== null && body.salary !== '') {
    if (isNaN(Number(body.salary)) || Number(body.salary) < 0) {
      errors.push('Salary must be a positive number.');
    }
  }

  return errors;
};

export const validateUpdateEmployee = (body) => {
  const errors = [];

  if (body.firstName !== undefined && (!body.firstName || !body.firstName.trim())) {
    errors.push('First name cannot be empty.');
  }

  if (body.lastName !== undefined && (!body.lastName || !body.lastName.trim())) {
    errors.push('Last name cannot be empty.');
  }

  if (body.email !== undefined && (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()))) {
    errors.push('A valid email address is required.');
  }

  if (body.salary !== undefined && body.salary !== null && body.salary !== '') {
    if (isNaN(Number(body.salary)) || Number(body.salary) < 0) {
      errors.push('Salary must be a positive number.');
    }
  }

  return errors;
};
