import { isValidMoney } from '../utils/financialUtils.js';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const VALID_PAYMENT_METHODS = ['BANK_TRANSFER', 'CHECK', 'CASH', 'DIRECT_DEPOSIT'];
const VALID_PERIOD_STATUSES = ['DRAFT', 'PROCESSING', 'PROCESSED', 'PAID', 'CANCELLED'];
const VALID_RECORD_STATUSES = ['DRAFT', 'PROCESSING', 'PROCESSED', 'PAID', 'CANCELLED'];
const VALID_ITEM_TYPES = ['EARNING', 'DEDUCTION'];

/**
 * Validates payload for creating a new Payroll Period
 */
export const validateCreatePeriod = (body) => {
  const errors = [];

  if (!body.periodName || typeof body.periodName !== 'string' || !body.periodName.trim()) {
    errors.push('Period name is required.');
  }

  if (!body.periodCode || typeof body.periodCode !== 'string' || !body.periodCode.trim()) {
    errors.push('Period code is required (e.g. 2026-M10).');
  }

  if (!body.startDate || typeof body.startDate !== 'string' || !DATE_REGEX.test(body.startDate.trim())) {
    errors.push('Start date is required in YYYY-MM-DD format.');
  }

  if (!body.endDate || typeof body.endDate !== 'string' || !DATE_REGEX.test(body.endDate.trim())) {
    errors.push('End date is required in YYYY-MM-DD format.');
  }

  if (!body.paymentDate || typeof body.paymentDate !== 'string' || !DATE_REGEX.test(body.paymentDate.trim())) {
    errors.push('Payment date is required in YYYY-MM-DD format.');
  }

  if (body.startDate && body.endDate && DATE_REGEX.test(body.startDate.trim()) && DATE_REGEX.test(body.endDate.trim())) {
    const start = new Date(body.startDate.trim());
    const end = new Date(body.endDate.trim());
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      errors.push('Please provide valid calendar dates.');
    } else if (start > end) {
      errors.push('Start date cannot be after end date.');
    }
  }

  if (body.startDate && body.paymentDate && DATE_REGEX.test(body.startDate.trim()) && DATE_REGEX.test(body.paymentDate.trim())) {
    const start = new Date(body.startDate.trim());
    const pay = new Date(body.paymentDate.trim());
    if (!isNaN(start.getTime()) && !isNaN(pay.getTime()) && pay < start) {
      errors.push('Payment date cannot be before period start date.');
    }
  }

  return errors;
};

/**
 * Validates payload for updating a Payroll Period
 */
export const validateUpdatePeriod = (body) => {
  const errors = [];

  if (body.periodName !== undefined && (typeof body.periodName !== 'string' || !body.periodName.trim())) {
    errors.push('Period name must not be empty.');
  }

  if (body.paymentDate !== undefined && (typeof body.paymentDate !== 'string' || !DATE_REGEX.test(body.paymentDate.trim()))) {
    errors.push('Payment date must be in YYYY-MM-DD format.');
  }

  if (body.status !== undefined && !VALID_PERIOD_STATUSES.includes(body.status.toUpperCase())) {
    errors.push(`Status must be one of: ${VALID_PERIOD_STATUSES.join(', ')}.`);
  }

  return errors;
};

/**
 * Validates payload for creating a Payroll Record
 */
export const validateCreatePayrollRecord = (body) => {
  const errors = [];

  if (!body.employeeId || typeof body.employeeId !== 'string' || !body.employeeId.trim()) {
    errors.push('Employee ID is required.');
  }

  if (!body.periodId || typeof body.periodId !== 'string' || !body.periodId.trim()) {
    errors.push('Period ID is required.');
  }

  if (body.baseSalary !== undefined && !isValidMoney(body.baseSalary)) {
    errors.push('Base salary must be a valid non-negative number.');
  }

  const workingDays = body.workingDays !== undefined ? parseFloat(body.workingDays) : 30;
  const paidDays = body.paidDays !== undefined ? parseFloat(body.paidDays) : workingDays;
  const lopDays = body.lossOfPayDays !== undefined ? parseFloat(body.lossOfPayDays) : 0;

  if (isNaN(workingDays) || workingDays < 0) {
    errors.push('Working days must be a non-negative number.');
  }

  if (isNaN(paidDays) || paidDays < 0) {
    errors.push('Paid days must be a non-negative number.');
  }

  if (!isNaN(workingDays) && !isNaN(paidDays) && paidDays > workingDays) {
    errors.push('Paid days cannot exceed working days.');
  }

  if (isNaN(lopDays) || lopDays < 0) {
    errors.push('Loss of pay days must be a non-negative number.');
  }

  if (body.paymentMethod && !VALID_PAYMENT_METHODS.includes(body.paymentMethod.toUpperCase())) {
    errors.push(`Payment method must be one of: ${VALID_PAYMENT_METHODS.join(', ')}.`);
  }

  // Validate items array if provided
  if (body.items !== undefined) {
    if (!Array.isArray(body.items)) {
      errors.push('Items must be an array of earning or deduction items.');
    } else {
      body.items.forEach((item, index) => {
        if (!item || typeof item !== 'object') {
          errors.push(`Item at index ${index} must be an object.`);
          return;
        }
        if (!item.name || typeof item.name !== 'string' || !item.name.trim()) {
          errors.push(`Item ${index + 1}: Name is required.`);
        }
        if (!item.itemType || !VALID_ITEM_TYPES.includes(item.itemType.toUpperCase())) {
          errors.push(`Item ${index + 1}: Type must be EARNING or DEDUCTION.`);
        }
        if (!isValidMoney(item.amount)) {
          errors.push(`Item ${index + 1}: Amount must be a valid non-negative number.`);
        }
      });
    }
  }

  return errors;
};

/**
 * Validates payload for updating an existing Payroll Record
 */
export const validateUpdatePayrollRecord = (body) => {
  const errors = [];

  if (body.baseSalary !== undefined && !isValidMoney(body.baseSalary)) {
    errors.push('Base salary must be a valid non-negative number.');
  }

  if (body.workingDays !== undefined && (isNaN(parseFloat(body.workingDays)) || parseFloat(body.workingDays) < 0)) {
    errors.push('Working days must be a non-negative number.');
  }

  if (body.paidDays !== undefined && (isNaN(parseFloat(body.paidDays)) || parseFloat(body.paidDays) < 0)) {
    errors.push('Paid days must be a non-negative number.');
  }

  if (body.lossOfPayDays !== undefined && (isNaN(parseFloat(body.lossOfPayDays)) || parseFloat(body.lossOfPayDays) < 0)) {
    errors.push('Loss of pay days must be a non-negative number.');
  }

  if (body.workingDays !== undefined && body.paidDays !== undefined) {
    if (parseFloat(body.paidDays) > parseFloat(body.workingDays)) {
      errors.push('Paid days cannot exceed working days.');
    }
  }

  if (body.paymentMethod && !VALID_PAYMENT_METHODS.includes(body.paymentMethod.toUpperCase())) {
    errors.push(`Payment method must be one of: ${VALID_PAYMENT_METHODS.join(', ')}.`);
  }

  if (body.items !== undefined) {
    if (!Array.isArray(body.items)) {
      errors.push('Items must be an array.');
    } else {
      body.items.forEach((item, index) => {
        if (!item.name || typeof item.name !== 'string' || !item.name.trim()) {
          errors.push(`Item ${index + 1}: Name is required.`);
        }
        if (!item.itemType || !VALID_ITEM_TYPES.includes(item.itemType.toUpperCase())) {
          errors.push(`Item ${index + 1}: Type must be EARNING or DEDUCTION.`);
        }
        if (!isValidMoney(item.amount)) {
          errors.push(`Item ${index + 1}: Amount must be a valid non-negative number.`);
        }
      });
    }
  }

  return errors;
};

/**
 * Validates updating record status
 */
export const validateUpdateRecordStatus = (body) => {
  const errors = [];
  if (!body.status || !VALID_RECORD_STATUSES.includes(body.status.toUpperCase())) {
    errors.push(`Status is required and must be one of: ${VALID_RECORD_STATUSES.join(', ')}.`);
  }
  return errors;
};

/**
 * Validates payroll profile upsert
 */
export const validateUpsertProfile = (body) => {
  const errors = [];
  if (body.baseSalary !== undefined && !isValidMoney(body.baseSalary)) {
    errors.push('Base salary must be a valid non-negative number.');
  }
  if (body.paymentMethod && !VALID_PAYMENT_METHODS.includes(body.paymentMethod.toUpperCase())) {
    errors.push(`Payment method must be one of: ${VALID_PAYMENT_METHODS.join(', ')}.`);
  }
  return errors;
};
