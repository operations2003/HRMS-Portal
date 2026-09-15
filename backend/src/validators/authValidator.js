export const validateLogin = (body) => {
  const errors = [];
  if (!body.email || typeof body.email !== 'string' || !body.email.trim()) {
    errors.push('Email is required.');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    errors.push('Please enter a valid email address.');
  }

  if (!body.password || typeof body.password !== 'string' || !body.password.trim()) {
    errors.push('Password is required.');
  }

  return errors;
};
