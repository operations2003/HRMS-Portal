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

  // Return and Reject require comments / reason
  if ((action === 'REJECT' || action === 'RETURN') && (!body.comments || !body.comments.trim())) {
    errors.push(`Comments or reason are required for ${action} action.`);
  }

  return errors;
};
