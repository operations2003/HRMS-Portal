-- =====================================================================
-- Migration 055: Extend approval_workflows stage and status constraints
-- Ensures WITHDRAWN and CANCELLED are supported across workflow states
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
        'CANCELLED',
        'WITHDRAWN'
    )
);

-- 2. Extend approval_workflows current_stage check constraint
ALTER TABLE approval_workflows DROP CONSTRAINT IF EXISTS approval_workflows_current_stage_check;
ALTER TABLE approval_workflows ADD CONSTRAINT approval_workflows_current_stage_check CHECK (
    current_stage IN (
        'EMPLOYEE_SUBMISSION', 
        'MANAGER_REVIEW', 
        'HR_REVIEW', 
        'CLEARANCE_IN_PROGRESS', 
        'FNF_PENDING', 
        'COMPLETED', 
        'REJECTED', 
        'RETURNED',
        'CANCELLED',
        'WITHDRAWN'
    )
);
