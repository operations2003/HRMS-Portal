export const validateAtsHandoff = (body) => {
  const errors = [];

  if (!body.atsCandidateId || typeof body.atsCandidateId !== 'string' || !body.atsCandidateId.trim()) {
    errors.push('ATS Candidate ID (atsCandidateId) is required.');
  } else if (body.atsCandidateId.trim().length > 100) {
    errors.push('ATS Candidate ID must not exceed 100 characters.');
  }

  if (!body.orgId || typeof body.orgId !== 'string' || !body.orgId.trim()) {
    errors.push('Organization ID (orgId) is required.');
  }

  if (!body.firstName || typeof body.firstName !== 'string' || !body.firstName.trim()) {
    errors.push('Candidate first name is required.');
  } else if (body.firstName.trim().length > 100) {
    errors.push('Candidate first name must not exceed 100 characters.');
  }

  if (!body.lastName || typeof body.lastName !== 'string' || !body.lastName.trim()) {
    errors.push('Candidate last name is required.');
  } else if (body.lastName.trim().length > 100) {
    errors.push('Candidate last name must not exceed 100 characters.');
  }

  if (!body.email || typeof body.email !== 'string' || !body.email.trim()) {
    errors.push('Candidate email is required.');
  } else if (body.email.trim().length > 255) {
    errors.push('Email must not exceed 255 characters.');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    errors.push('Please provide a valid candidate email address.');
  }

  if (!body.dateOfJoining || typeof body.dateOfJoining !== 'string' || !body.dateOfJoining.trim()) {
    errors.push('Date of joining (dateOfJoining) is required.');
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(body.dateOfJoining.trim())) {
    errors.push('Date of joining must follow YYYY-MM-DD format.');
  } else {
    const [year, month, day] = body.dateOfJoining.trim().split('-').map(Number);
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
      errors.push('Date of joining is not a valid calendar date.');
    }
  }

  if (body.phone && typeof body.phone === 'string' && body.phone.trim().length > 50) {
    errors.push('Phone number must not exceed 50 characters.');
  }

  const compensationVal = body.salary ?? body.compensationRef ?? body.compensation;
  if (compensationVal !== undefined && compensationVal !== null && compensationVal !== '') {
    if (isNaN(Number(compensationVal)) || Number(compensationVal) < 0) {
      errors.push('Compensation/Salary must be a non-negative number.');
    }
  }

  if (body.offerDocuments !== undefined && body.offerDocuments !== null) {
    if (!Array.isArray(body.offerDocuments)) {
      errors.push('offerDocuments must be an array of document objects.');
    } else {
      body.offerDocuments.forEach((doc, idx) => {
        if (!doc || typeof doc !== 'object') {
          errors.push(`offerDocuments[${idx}] must be an object.`);
        } else if (!doc.title && !doc.fileUrl) {
          errors.push(`offerDocuments[${idx}] requires at least a title or fileUrl.`);
        }
      });
    }
  }

  return errors;
};
