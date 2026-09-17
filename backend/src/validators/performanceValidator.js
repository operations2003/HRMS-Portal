/**
 * Validators for Performance Management System
 */

const VALID_PERIOD_TYPES = ['ANNUAL', 'MID_YEAR', 'QUARTERLY', 'PROBATION', 'SPECIAL'];
const VALID_PERIOD_STATUSES = ['ACTIVE', 'CLOSED', 'ARCHIVED'];

export const validateCreatePeriod = (body) => {
  const errors = [];

  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    errors.push('Period name is required.');
  } else if (body.name.trim().length < 3) {
    errors.push('Period name must be at least 3 characters long.');
  }

  if (!body.code || typeof body.code !== 'string' || !body.code.trim()) {
    errors.push('Period code is required (e.g., FY26-Q3, ANNUAL-2026).');
  }

  if (body.periodType && !VALID_PERIOD_TYPES.includes(body.periodType.toUpperCase())) {
    errors.push(`Period type must be one of: ${VALID_PERIOD_TYPES.join(', ')}.`);
  }

  if (!body.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(body.startDate)) {
    errors.push('Valid start date (YYYY-MM-DD) is required.');
  }

  if (!body.endDate || !/^\d{4}-\d{2}-\d{2}$/.test(body.endDate)) {
    errors.push('Valid end date (YYYY-MM-DD) is required.');
  }

  if (body.startDate && body.endDate && body.endDate < body.startDate) {
    errors.push('End date must be on or after start date.');
  }

  return errors;
};

export const validateUpdatePeriod = (body) => {
  const errors = [];

  if (body.status && !VALID_PERIOD_STATUSES.includes(body.status.toUpperCase())) {
    errors.push(`Status must be one of: ${VALID_PERIOD_STATUSES.join(', ')}.`);
  }

  if (body.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)) {
    errors.push('Due date must be in YYYY-MM-DD format.');
  }

  return errors;
};

export const validateCreateRecord = (body) => {
  const errors = [];

  if (!body.employeeId || typeof body.employeeId !== 'string' || !body.employeeId.trim()) {
    errors.push('Employee ID is required.');
  }

  if (!body.reviewPeriod || typeof body.reviewPeriod !== 'string' || !body.reviewPeriod.trim()) {
    errors.push('Review period identifier is required (e.g., Q3 2026).');
  }

  if (body.rating !== undefined && body.rating !== null) {
    const r = parseFloat(body.rating);
    if (isNaN(r) || r < 1.0 || r > 5.0) {
      errors.push('Rating must be a numeric score between 1.00 and 5.00.');
    }
  }

  return errors;
};

export const validateUpdateDraftRecord = (body) => {
  const errors = [];

  if (body.rating !== undefined && body.rating !== null) {
    const r = parseFloat(body.rating);
    if (isNaN(r) || r < 1.0 || r > 5.0) {
      errors.push('Rating must be between 1.00 and 5.00.');
    }
  }

  if (body.score !== undefined && body.score !== null) {
    const s = parseFloat(body.score);
    if (isNaN(s) || s < 0 || s > 100) {
      errors.push('Score must be between 0.00 and 100.00.');
    }
  }

  return errors;
};

export const validateManagerReview = (body) => {
  const errors = [];

  if (body.rating !== undefined && body.rating !== null) {
    const r = parseFloat(body.rating);
    if (isNaN(r) || r < 1.0 || r > 5.0) {
      errors.push('Manager rating must be between 1.00 and 5.00.');
    }
  }

  if (!body.reviewerComments || typeof body.reviewerComments !== 'string' || !body.reviewerComments.trim()) {
    errors.push('Reviewer comments / evaluation notes are required.');
  }

  return errors;
};

export const validateReturnOrRejectRecord = (body) => {
  const errors = [];

  if (!body.rejectionReason || typeof body.rejectionReason !== 'string' || !body.rejectionReason.trim()) {
    errors.push('A reason is required when returning or rejecting an appraisal.');
  } else if (body.rejectionReason.trim().length < 5) {
    errors.push('Reason must be at least 5 characters long.');
  }

  return errors;
};

export const validateGoal = (body) => {
  const errors = [];

  if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
    errors.push('Goal title is required.');
  }

  if (body.weightage !== undefined && body.weightage !== null) {
    const w = parseFloat(body.weightage);
    if (isNaN(w) || w < 0 || w > 100) {
      errors.push('Weightage must be between 0% and 100%.');
    }
  }

  if (body.rating !== undefined && body.rating !== null) {
    const r = parseFloat(body.rating);
    if (isNaN(r) || r < 1.0 || r > 5.0) {
      errors.push('Goal rating must be between 1.00 and 5.00.');
    }
  }

  return errors;
};
