-- =====================================================================
-- Migration 022: Phase 6 Notifications Integration
-- Expands notifications event_type check constraint to include Phase 6 events:
-- - Performance: PERFORMANCE_REVIEW_PENDING, PERFORMANCE_APPROVED, PERFORMANCE_RETURNED, PERFORMANCE_REJECTED
-- - Leaves: LEAVE_APPROVAL_PENDING, LEAVE_APPROVED, LEAVE_REJECTED
-- - Managers/HR: MANAGER_ASSIGNED
-- =====================================================================

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_event_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_event_type_check CHECK (
    event_type IN (
        -- Phase 5
        'PAYROLL_PROCESSED',
        'PAYSLIP_AVAILABLE',
        'TICKET_CREATED',
        'TICKET_STATUS_CHANGED',
        'EMPLOYEE_REQUEST_CREATED',
        'EMPLOYEE_REQUEST_STATUS_CHANGED',
        'GENERAL_ALERT',
        -- Phase 6
        'PERFORMANCE_REVIEW_PENDING',
        'PERFORMANCE_APPROVED',
        'PERFORMANCE_RETURNED',
        'PERFORMANCE_REJECTED',
        'LEAVE_APPROVAL_PENDING',
        'LEAVE_APPROVED',
        'LEAVE_REJECTED',
        'MANAGER_ASSIGNED'
    )
);
