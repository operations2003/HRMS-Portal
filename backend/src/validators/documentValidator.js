export const validateAddDocument = (body) => {
  const errors = [];
  const allowedCategories = ['IDENTITY', 'TAX', 'EDUCATION', 'OFFER', 'EXPERIENCE', 'MEDICAL', 'OTHER'];
  const allowedOwnerTypes = ['NEW_HIRE', 'EMPLOYEE', 'CANDIDATE'];

  if (!body.orgId || typeof body.orgId !== 'string' || !body.orgId.trim()) {
    errors.push('Organization ID (orgId) is required.');
  }

  if (!body.ownerId || typeof body.ownerId !== 'string' || !body.ownerId.trim()) {
    errors.push('Owner ID (ownerId) is required.');
  }

  if (body.ownerType && !allowedOwnerTypes.includes(body.ownerType.trim().toUpperCase())) {
    errors.push(`Invalid ownerType. Allowed: ${allowedOwnerTypes.join(', ')}`);
  }

  if (!body.category || !allowedCategories.includes(body.category.trim().toUpperCase())) {
    errors.push(`Category is required. Allowed: ${allowedCategories.join(', ')}`);
  }

  if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
    errors.push('Document title is required.');
  }

  if (!body.fileUrl || typeof body.fileUrl !== 'string' || !body.fileUrl.trim()) {
    errors.push('Document fileUrl is required.');
  }

  return errors;
};

export const validateDocumentUploadMetadata = (body) => {
  const errors = [];
  const allowedCategories = ['IDENTITY', 'TAX', 'EDUCATION', 'OFFER', 'EXPERIENCE', 'MEDICAL', 'OTHER'];

  if (body.category && !allowedCategories.includes(body.category.trim().toUpperCase())) {
    errors.push(`Invalid category. Allowed: ${allowedCategories.join(', ')}`);
  }

  if (body.title && typeof body.title === 'string' && body.title.trim().length > 255) {
    errors.push('Document title must not exceed 255 characters.');
  }

  return errors;
};

export const validateVerifyDocument = (body) => {
  const errors = [];
  const allowed = ['APPROVED', 'REJECTED', 'PENDING'];

  if (!body.verificationStatus || !allowed.includes(body.verificationStatus.trim().toUpperCase())) {
    errors.push(`Verification status is required. Allowed: ${allowed.join(', ')}`);
  }

  if (body.verificationStatus && body.verificationStatus.trim().toUpperCase() === 'REJECTED') {
    if (!body.rejectionReason || typeof body.rejectionReason !== 'string' || !body.rejectionReason.trim()) {
      errors.push('Rejection reason is required when rejecting a document.');
    }
  }

  return errors;
};
