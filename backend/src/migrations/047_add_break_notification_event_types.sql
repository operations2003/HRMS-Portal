-- Migration 047: Add Break Tracking Notification Event Types
-- Extends notifications event_type check constraint to include break tracking events for HR, Manager, and Admin visibility.

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
        'MANAGER_ASSIGNED',
        -- Phase 7
        'RESIGNATION_SUBMITTED',
        'EXIT_REVIEW_PENDING',
        'EXIT_APPROVED',
        'EXIT_REJECTED',
        'CLEARANCE_TASK_ASSIGNED',
        'CLEARANCE_TASK_COMPLETED',
        'DEPROVISIONING_EXECUTED',
        'FNF_SETTLEMENT_PROCESSED',
        'EXIT_COMPLETED',
        -- Break Tracking
        'EMPLOYEE_ON_BREAK',
        'EMPLOYEE_RESUMED_BREAK'
    )
);
