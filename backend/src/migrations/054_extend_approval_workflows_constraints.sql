-- =====================================================================
-- Migration 054: Extend approval_workflows and actions constraints
-- Supports Company Terminations, Exit Processing, and Direct Assignments
-- =====================================================================

-- 1. Extend approval_workflows current_status check constraint
ALTER TABLE approval_workflows DROP CONSTRAINT IF EXISTS approval_workflows_current_status_check;
ALTER TABLE approval_workflows ADD CONSTRAINT approval_workflows_current_status_check CHECK (
    current_status IN (
        'PENDING', 
        'SUBMITTED', 
        'UNDER_REVIEW', 
        'APPROVED', 
        'REJECTED', 
        'RETURNED', 
        'COMPLETED', 
        'EXIT_PROCESSING', 
        'NOTICE_PERIOD', 
        'CANCELLED'
    )
);

-- 2. Extend approval_workflows workflow_type check constraint
ALTER TABLE approval_workflows DROP CONSTRAINT IF EXISTS approval_workflows_workflow_type_check;
ALTER TABLE approval_workflows ADD CONSTRAINT approval_workflows_workflow_type_check CHECK (
    workflow_type IN (
        'EMPLOYEE_MANAGER_HR', 
        'EMPLOYEE_MANAGER', 
        'EMPLOYEE_HR', 
        'COMPANY_TERMINATION', 
        'DIRECT_ASSIGNMENT'
    )
);

-- 3. Extend approval_workflow_actions stage check constraint
ALTER TABLE approval_workflow_actions DROP CONSTRAINT IF EXISTS approval_workflow_actions_stage_check;
ALTER TABLE approval_workflow_actions ADD CONSTRAINT approval_workflow_actions_stage_check CHECK (
    stage IN (
        'EMPLOYEE_SUBMISSION', 
        'MANAGER_REVIEW', 
        'HR_REVIEW', 
        'CLEARANCE_IN_PROGRESS', 
        'FNF_PENDING', 
        'COMPLETED',
        'ASSIGNMENT'
    )
);

-- 4. Extend approval_workflow_actions action check constraint
ALTER TABLE approval_workflow_actions DROP CONSTRAINT IF EXISTS approval_workflow_actions_action_check;
ALTER TABLE approval_workflow_actions ADD CONSTRAINT approval_workflow_actions_action_check CHECK (
    action IN (
        'SUBMIT', 
        'START_REVIEW', 
        'SUBMIT_REVIEW', 
        'REVIEW', 
        'APPROVE', 
        'REJECT', 
        'RETURN', 
        'CANCEL', 
        'DEPROVISION',
        'ASSIGN'
    )
);
