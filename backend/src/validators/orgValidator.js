export const validateCreateOrg = (body) => {
  const errors = [];

  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    errors.push('Organization name is required.');
  }

  if (!body.code || typeof body.code !== 'string' || !body.code.trim()) {
    errors.push('Organization code is required.');
  } else if (!/^[A-Za-z0-9_-]{2,10}$/.test(body.code.trim())) {
    errors.push('Organization code must be 2-10 alphanumeric characters (hyphens and underscores allowed).');
  }

  if (!body.email || typeof body.email !== 'string' || !body.email.trim()) {
    errors.push('Official email is required.');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    errors.push('Please enter a valid official email address.');
  }

  if (body.website && typeof body.website === 'string' && body.website.trim()) {
    if (!/^https?:\/\/.+/.test(body.website.trim())) {
      errors.push('Website must begin with http:// or https://');
    }
  }

  return errors;
};

export const validateUpdateOrg = (body) => {
  const errors = [];

  if (body.name !== undefined && (!body.name || !body.name.trim())) {
    errors.push('Organization name cannot be empty.');
  }

  if (body.email !== undefined && (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()))) {
    errors.push('A valid email address is required.');
  }

  if (body.website && !/^https?:\/\/.+/.test(body.website.trim())) {
    errors.push('Website must begin with http:// or https://');
  }

  return errors;
};
