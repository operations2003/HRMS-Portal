/**
 * Validators for Approval Workflow Engine
 */

const VALID_WORKFLOW_ACTIONS = [
  'SUBMIT',
  'START_REVIEW',
  'SUBMIT_REVIEW',
  'APPROVE',
  'REJECT',
  'RETURN',
  'CANCEL',
];

export const validateWorkflowAction = (body) => {
  const errors = [];

  if (!body.action || typeof body.action !== 'string' || !VALID_WORKFLOW_ACTIONS.includes(body.action.toUpperCase())) {
    errors.push(`Workflow action is required and must be one of: ${VALID_WORKFLOW_ACTIONS.join(', ')}.`);
  }

  const action = (body.action || '').toUpperCase();
  const reason = (body.comments || body.reason || body.rejectionReason || '').trim();

  // Return and Reject require comments / reason
  if ((action === 'REJECT' || action === 'RETURN') && (!reason || reason.length < 5)) {
    errors.push(`Comments or reason (at least 5 characters) are required for ${action} action.`);
  }

  // If rating is supplied, validate range
  if (body.rating !== undefined && body.rating !== null) {
    const r = parseFloat(body.rating);
    if (isNaN(r) || r < 1.0 || r > 5.0) {
      errors.push('Rating must be a numeric score between 1.00 and 5.00.');
    }
  }

  return errors;
};
