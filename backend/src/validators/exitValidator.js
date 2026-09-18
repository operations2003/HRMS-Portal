/**
 * Phase 7 Exit & Offboarding Input Validators
 */

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const validateResignation = (body) => {
  const errors = [];

  if (!body.reason || typeof body.reason !== 'string' || !body.reason.trim()) {
    errors.push('Reason for resignation is required.');
  } else if (body.reason.trim().length < 5) {
    errors.push('Reason must be at least 5 characters long.');
  } else if (body.reason.trim().length > 2000) {
    errors.push('Reason must not exceed 2000 characters.');
  }

  if (!body.requestedLastWorkingDay || typeof body.requestedLastWorkingDay !== 'string' || !dateRegex.test(body.requestedLastWorkingDay.trim())) {
    errors.push('Requested last working day is required in YYYY-MM-DD format.');
  } else {
    const lDate = new Date(body.requestedLastWorkingDay.trim());
    if (isNaN(lDate.getTime())) {
      errors.push('Please provide a valid calendar date for requested last working day.');
    }
  }

  if (body.noticePeriodDays !== undefined && body.noticePeriodDays !== null) {
    const days = parseInt(body.noticePeriodDays, 10);
    if (isNaN(days) || days < 0) {
      errors.push('Notice period days must be a non-negative integer.');
    }
  }

  if (body.exitType !== undefined && body.exitType !== null) {
    const validTypes = ['VOLUNTARY', 'INVOLUNTARY', 'RETIREMENT', 'MUTUAL', 'CONTRACT_END'];
    if (!validTypes.includes(body.exitType.toUpperCase())) {
      errors.push(`Exit type must be one of: ${validTypes.join(', ')}.`);
    }
  }

  return errors;
};

export const validateManagerReview = (body) => {
  const errors = [];

  if (body.decision !== undefined && body.decision !== null) {
    const d = body.decision.toUpperCase();
    if (!['APPROVE', 'REJECT', 'RECOMMEND_APPROVAL', 'RECOMMEND_REJECTION'].includes(d)) {
      errors.push("Decision must be either 'APPROVE' or 'REJECT'.");
    }
  }

  if (!body.managerFeedback || typeof body.managerFeedback !== 'string' || !body.managerFeedback.trim()) {
    errors.push('Manager evaluation feedback is required.');
  } else if (body.managerFeedback.trim().length < 5) {
    errors.push('Manager feedback must be at least 5 characters long.');
  }

  if (body.managerRating !== undefined && body.managerRating !== null) {
    const r = parseFloat(body.managerRating);
    if (isNaN(r) || r < 1.0 || r > 5.0) {
      errors.push('Manager rating must be between 1.00 and 5.00.');
    }
  }

  if (body.recommendedLastWorkingDay !== undefined && body.recommendedLastWorkingDay !== null && body.recommendedLastWorkingDay !== '') {
    if (!dateRegex.test(body.recommendedLastWorkingDay.trim())) {
      errors.push('Recommended last working day must be in YYYY-MM-DD format.');
    }
  }

  return errors;
};

export const validateHrApproval = (body) => {
  const errors = [];

  if (!body.approvedLastWorkingDay || typeof body.approvedLastWorkingDay !== 'string' || !dateRegex.test(body.approvedLastWorkingDay.trim())) {
    errors.push('Approved last working day is required in YYYY-MM-DD format.');
  } else {
    const lDate = new Date(body.approvedLastWorkingDay.trim());
    if (isNaN(lDate.getTime())) {
      errors.push('Please provide a valid calendar date for approved last working day.');
    }
  }

  if (body.noticePeriodDays !== undefined && body.noticePeriodDays !== null) {
    const days = parseInt(body.noticePeriodDays, 10);
    if (isNaN(days) || days < 0) {
      errors.push('Notice period days must be a non-negative integer.');
    }
  }

  return errors;
};

export const validateHrReject = (body) => {
  const errors = [];

  if (!body.rejectionReason || typeof body.rejectionReason !== 'string' || !body.rejectionReason.trim()) {
    errors.push('Rejection reason is required.');
  } else if (body.rejectionReason.trim().length < 5) {
    errors.push('Rejection reason must be at least 5 characters long.');
  }

  return errors;
};

export const validateClearanceUpdate = (body) => {
  const errors = [];
  const validStatuses = ['PENDING', 'IN_PROGRESS', 'CLEARED', 'COMPLETED', 'REJECTED', 'WAIVED', 'NOT_APPLICABLE'];

  if (!body.status || typeof body.status !== 'string' || !validStatuses.includes(body.status.toUpperCase())) {
    errors.push(`Status must be one of: ${validStatuses.join(', ')}.`);
  }

  if (body.recoveryAmount !== undefined && body.recoveryAmount !== null) {
    const amt = parseFloat(body.recoveryAmount);
    if (isNaN(amt) || amt < 0) {
      errors.push('Recovery amount must be a non-negative number.');
    }
  }

  return errors;
};

export const validateCustomClearanceTask = (body) => {
  const errors = [];
  const validDepts = ['IT', 'FINANCE', 'ADMIN', 'MANAGER', 'HR', 'OPERATIONS', 'LEGAL'];
  const validCategories = [
    'MANAGER_HANDOVER',
    'HR_CLEARANCE',
    'IT_ACCESS',
    'ASSETS_RETURNED',
    'DOCUMENTS',
    'KNOWLEDGE_TRANSFER',
    'FINANCE_PAYROLL',
    'FINAL_APPROVAL',
    'GENERAL',
  ];

  if (!body.taskTitle || typeof body.taskTitle !== 'string' || body.taskTitle.trim().length < 3) {
    errors.push('Task title is required (minimum 3 characters).');
  }

  if (!body.departmentScope || typeof body.departmentScope !== 'string' || !validDepts.includes(body.departmentScope.toUpperCase())) {
    errors.push(`Department scope must be one of: ${validDepts.join(', ')}.`);
  }

  if (body.checklistCategory && !validCategories.includes(body.checklistCategory.toUpperCase())) {
    errors.push(`Checklist category must be one of: ${validCategories.join(', ')}.`);
  }

  if (body.recoveryAmount !== undefined && body.recoveryAmount !== null) {
    const amt = parseFloat(body.recoveryAmount);
    if (isNaN(amt) || amt < 0) {
      errors.push('Recovery amount must be a non-negative number.');
    }
  }

  return errors;
};

export const validateFnfSettlement = (body) => {
  const errors = [];

  if (body.payableDays !== undefined && body.payableDays !== null) {
    const pDays = parseFloat(body.payableDays);
    if (isNaN(pDays) || pDays < 0) {
      errors.push('Payable days must be a non-negative number.');
    }
  }

  const numericFields = [
    'dailyRate',
    'salaryPayable',
    'bonusGratuity',
    'otherAllowances',
    'reimbursements',
    'noticePeriodRecovery',
    'assetRecoveryDeduction',
    'taxDeduction',
    'otherDeductions',
  ];
  for (const f of numericFields) {
    if (body[f] !== undefined && body[f] !== null) {
      const val = parseFloat(body[f]);
      if (isNaN(val) || val < 0) {
        errors.push(`${f} must be a non-negative number.`);
      }
    }
  }

  return errors;
};

export const validateAccessRemoval = (body) => {
  const errors = [];
  if (body.reassignManagerId && typeof body.reassignManagerId !== 'string') {
    errors.push('reassignManagerId must be a valid ID string.');
  }
  return errors;
};

export const validateOffboardingUpdate = (body) => {
  const errors = [];
  const validAssetStatuses = ['PENDING', 'RETURNED', 'RETAINED', 'DAMAGED_DEDUCTED', 'WAIVED'];

  if (body.assetStatus && !validAssetStatuses.includes(body.assetStatus.toUpperCase())) {
    errors.push(`Asset status must be one of: ${validAssetStatuses.join(', ')}.`);
  }

  return errors;
};
