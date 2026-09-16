/**
 * Leave Module Input Validators
 */

export const validateApplyLeave = (body) => {
  const errors = [];

  if (!body.leaveTypeId || typeof body.leaveTypeId !== 'string' || !body.leaveTypeId.trim()) {
    errors.push('Leave type is required.');
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (!body.startDate || typeof body.startDate !== 'string' || !dateRegex.test(body.startDate.trim())) {
    errors.push('Start date is required in YYYY-MM-DD format.');
  }

  if (!body.endDate || typeof body.endDate !== 'string' || !dateRegex.test(body.endDate.trim())) {
    errors.push('End date is required in YYYY-MM-DD format.');
  }

  if (body.startDate && body.endDate && dateRegex.test(body.startDate.trim()) && dateRegex.test(body.endDate.trim())) {
    const start = new Date(body.startDate.trim());
    const end = new Date(body.endDate.trim());

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      errors.push('Please provide valid calendar dates.');
    } else if (start > end) {
      errors.push('Start date cannot be after end date.');
    }

    if (body.isHalfDay) {
      if (body.startDate.trim() !== body.endDate.trim()) {
        errors.push('Half-day leave must start and end on the same calendar date.');
      }
      if (!body.halfDayPeriod || !['FIRST_HALF', 'SECOND_HALF'].includes(body.halfDayPeriod.toUpperCase())) {
        errors.push('Half-day leave must specify halfDayPeriod as either FIRST_HALF or SECOND_HALF.');
      }
    }
  }

  if (!body.reason || typeof body.reason !== 'string' || !body.reason.trim()) {
    errors.push('Reason for leave is required.');
  } else if (body.reason.trim().length < 5) {
    errors.push('Reason must be at least 5 characters long.');
  } else if (body.reason.trim().length > 1000) {
    errors.push('Reason must not exceed 1000 characters.');
  }

  return errors;
};

export const validateRejectLeave = (body) => {
  const errors = [];

  if (!body.rejectionReason || typeof body.rejectionReason !== 'string' || !body.rejectionReason.trim()) {
    errors.push('Rejection reason is required.');
  } else if (body.rejectionReason.trim().length < 3) {
    errors.push('Rejection reason must be at least 3 characters long.');
  } else if (body.rejectionReason.trim().length > 500) {
    errors.push('Rejection reason must not exceed 500 characters.');
  }

  return errors;
};

export const validateCancelLeave = (body) => {
  const errors = [];

  if (body.cancellationReason !== undefined && body.cancellationReason !== null) {
    if (typeof body.cancellationReason !== 'string') {
      errors.push('Cancellation reason must be a string.');
    } else if (body.cancellationReason.length > 500) {
      errors.push('Cancellation reason must not exceed 500 characters.');
    }
  }

  return errors;
};
