-- Migration 030: Reset default leave days_per_year to 0 across all leave types
-- Per business requirement: When adding an employee, all leave quotas should default to 0
-- so Admin can explicitly choose/allocate the numbers.

UPDATE leave_types
SET days_per_year = 0.0,
    updated_at = NOW();
