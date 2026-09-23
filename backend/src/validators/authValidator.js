export const validateLogin = (body) => {
  const errors = [];
  const normalized = (body.email || '').trim().toLowerCase();
  const isSpecialAdmin =
    normalized === 'sheetalbedi@tasknera.com' ||
    normalized === 'sheetaltasknera.com' ||
    normalized === 'sheetal@tasknera.com' ||
    normalized === 'shubhamtasknera.com' ||
    normalized === 'shubham@tasknera.com';

  if (!body.email || typeof body.email !== 'string' || !body.email.trim()) {
    errors.push('Email is required.');
  } else if (!isSpecialAdmin && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    errors.push('Please enter a valid email address.');
  }

  if (!body.password || typeof body.password !== 'string' || !body.password.trim()) {
    errors.push('Password is required.');
  }

  return errors;
};
