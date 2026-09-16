/**
 * Attendance Input Validators
 */

const VALID_SOURCES = ['WEB', 'MOBILE', 'BIOMETRIC', 'MANUAL', 'API'];
const VALID_STATUSES = ['PRESENT', 'ABSENT', 'HALF_DAY', 'LATE', 'ON_LEAVE', 'HOLIDAY', 'WEEKEND', 'REGULARIZED'];

/**
 * Validate Check-In Payload
 */
export const validateCheckIn = (body) => {
  const errors = [];

  if (body.timezone !== undefined && body.timezone !== null) {
    if (typeof body.timezone !== 'string' || body.timezone.trim().length > 50) {
      errors.push('Timezone must be a string not exceeding 50 characters.');
    }
  }

  if (body.source !== undefined && body.source !== null) {
    if (typeof body.source !== 'string' || !VALID_SOURCES.includes(body.source.toUpperCase())) {
      errors.push(`Source must be one of: ${VALID_SOURCES.join(', ')}.`);
    }
  }

  if (body.location !== undefined && body.location !== null) {
    if (typeof body.location !== 'object' || Array.isArray(body.location)) {
      errors.push('Location must be an object.');
    } else {
      if (body.location.latitude !== undefined && isNaN(Number(body.location.latitude))) {
        errors.push('Location latitude must be a valid number.');
      }
      if (body.location.longitude !== undefined && isNaN(Number(body.location.longitude))) {
        errors.push('Location longitude must be a valid number.');
      }
    }
  }

  if (body.notes !== undefined && body.notes !== null) {
    if (typeof body.notes !== 'string' || body.notes.length > 500) {
      errors.push('Notes must not exceed 500 characters.');
    }
  }

  if (body.employeeId !== undefined && body.employeeId !== null) {
    if (typeof body.employeeId !== 'string' || !body.employeeId.trim()) {
      errors.push('employeeId must be a non-empty string when provided.');
    }
  }

  return errors;
};

/**
 * Validate Check-Out Payload
 */
export const validateCheckOut = (body) => {
  const errors = [];

  if (body.breakDurationMinutes !== undefined && body.breakDurationMinutes !== null) {
    const breaks = Number(body.breakDurationMinutes);
    if (isNaN(breaks) || breaks < 0 || breaks > 720) {
      errors.push('breakDurationMinutes must be an integer between 0 and 720.');
    }
  }

  if (body.notes !== undefined && body.notes !== null) {
    if (typeof body.notes !== 'string' || body.notes.length > 500) {
      errors.push('Notes must not exceed 500 characters.');
    }
  }

  if (body.location !== undefined && body.location !== null) {
    if (typeof body.location !== 'object' || Array.isArray(body.location)) {
      errors.push('Location must be an object.');
    }
  }

  if (body.employeeId !== undefined && body.employeeId !== null) {
    if (typeof body.employeeId !== 'string' || !body.employeeId.trim()) {
      errors.push('employeeId must be a non-empty string when provided.');
    }
  }

  return errors;
};

/**
 * Validate Attendance Regularization Payload
 */
export const validateRegularize = (body) => {
  const errors = [];

  if (!body.regularizationReason || typeof body.regularizationReason !== 'string' || !body.regularizationReason.trim()) {
    errors.push('Regularization reason is required.');
  } else if (body.regularizationReason.trim().length < 5) {
    errors.push('Regularization reason must be at least 5 characters long.');
  } else if (body.regularizationReason.trim().length > 500) {
    errors.push('Regularization reason must not exceed 500 characters.');
  }

  if (body.status !== undefined && body.status !== null) {
    if (typeof body.status !== 'string' || !VALID_STATUSES.includes(body.status.toUpperCase())) {
      errors.push(`Status must be one of: ${VALID_STATUSES.join(', ')}.`);
    }
  }

  if (body.checkIn !== undefined && body.checkIn !== null && body.checkIn !== '') {
    const d = new Date(body.checkIn);
    if (isNaN(d.getTime())) {
      errors.push('checkIn must be a valid ISO date/timestamp string.');
    }
  }

  if (body.checkOut !== undefined && body.checkOut !== null && body.checkOut !== '') {
    const d = new Date(body.checkOut);
    if (isNaN(d.getTime())) {
      errors.push('checkOut must be a valid ISO date/timestamp string.');
    }
  }

  if (body.checkIn && body.checkOut) {
    const inTime = new Date(body.checkIn).getTime();
    const outTime = new Date(body.checkOut).getTime();
    if (outTime < inTime) {
      errors.push('checkOut timestamp cannot be earlier than checkIn timestamp.');
    }
  }

  return errors;
};
