export const validateCreateUser = (body) => {
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
