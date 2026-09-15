export const validateCreateEmployee = (body) => {
  const errors = [];

  if (!body.firstName || typeof body.firstName !== 'string' || !body.firstName.trim()) {
    errors.push('First name is required.');
  } else if (body.firstName.trim().length > 100) {
    errors.push('First name must not exceed 100 characters.');
  }

  if (!body.lastName || typeof body.lastName !== 'string' || !body.lastName.trim()) {
    errors.push('Last name is required.');
  } else if (body.lastName.trim().length > 100) {
    errors.push('Last name must not exceed 100 characters.');
  }

  if (!body.email || typeof body.email !== 'string' || !body.email.trim()) {
    errors.push('Email is required.');
  } else if (body.email.trim().length > 255) {
    errors.push('Email must not exceed 255 characters.');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    errors.push('Please enter a valid email address.');
  }

  if (!body.orgId || typeof body.orgId !== 'string' || !body.orgId.trim()) {
    errors.push('Organization selection is required.');
  }

  if (body.employeeCode !== undefined && (typeof body.employeeCode !== 'string' || !body.employeeCode.trim())) {
    errors.push('Employee ID / Code cannot be empty.');
  } else if (body.employeeCode && body.employeeCode.trim().length > 100) {
    errors.push('Employee ID / Code must not exceed 100 characters.');
  }

  if (body.dateOfJoining !== undefined && body.dateOfJoining !== null && body.dateOfJoining !== '') {
    if (typeof body.dateOfJoining !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.dateOfJoining.trim())) {
      errors.push('Please enter a valid joining date (YYYY-MM-DD).');
    } else {
      const [year, month, day] = body.dateOfJoining.trim().split('-').map(Number);
      const d = new Date(year, month - 1, day);
      if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
        errors.push('Please enter a valid calendar date (e.g. 2025-02-29 is invalid in a non-leap year).');
      }
    }
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

  if (body.employeeCode !== undefined && (!body.employeeCode || !body.employeeCode.trim())) {
    errors.push('Employee ID / Code cannot be empty.');
  }

  if (body.dateOfJoining !== undefined && body.dateOfJoining !== null && body.dateOfJoining !== '') {
    const parsed = Date.parse(body.dateOfJoining);
    if (isNaN(parsed)) {
      errors.push('Please enter a valid joining date (YYYY-MM-DD).');
    }
  }

  if (body.salary !== undefined && body.salary !== null && body.salary !== '') {
    if (isNaN(Number(body.salary)) || Number(body.salary) < 0) {
      errors.push('Salary must be a positive number.');
    }
  }

  return errors;
};
