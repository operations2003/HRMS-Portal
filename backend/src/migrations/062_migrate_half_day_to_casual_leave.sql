-- Migration 062: Migrate Half Day Leaves to Casual Leave & Sync Balances
-- Purpose: Half Day is not an independent leave category; it is a 0.5-day duration applied to and deducted from Casual Leave (CL).
-- 1. Converts all legacy 'lt-hdl' leave requests to 'lt-cl' with is_half_day = true, total_days = 0.5.
-- 2. Ensures Prabhjot Gora's leave request lr-1791026344049-852 date decisions include all 4 days (Oct 7-10, total_days = 4.0).
-- 3. Syncs Prabhjot Gora's Casual Leave balance for 2026 to allocated_days = 6.0, used_days = 6.0, pending_days = 0.0.
-- 4. Syncs Nabila Hussain's Casual Leave balance for 2026 to include the Oct 3 half day (used_days = 2.5).
-- 5. Removes any inactive 'lt-hdl' rows from leave_balances.

-- Step 1: Migrate any leave requests assigned to lt-hdl to lt-cl
UPDATE leave_requests
SET leave_type_id = 'lt-cl',
    is_half_day = TRUE,
    total_days = 0.5,
    updated_at = NOW()
WHERE leave_type_id = 'lt-hdl' OR leave_type_id IN (
  SELECT id FROM leave_types WHERE UPPER(code) = 'HDL' OR LOWER(name) = 'half day'
);

-- Step 2: Ensure Prabhjot Gora lr-1791026344049-852 has all 4 dates approved in date_decisions
UPDATE leave_requests
SET date_decisions = '[{"date":"2026-10-07","reason":"","status":"APPROVED","dayFraction":1},{"date":"2026-10-08","reason":"","status":"APPROVED","dayFraction":1},{"date":"2026-10-09","reason":"","status":"APPROVED","dayFraction":1},{"date":"2026-10-10","reason":"","status":"APPROVED","dayFraction":1}]'::jsonb,
    total_days = 4.0,
    updated_at = NOW()
WHERE id = 'lr-1791026344049-852';

-- Step 3: Sync Prabhjot Gora Casual Leave balance (alloc=6.0, used=6.0, pending=0.0)
UPDATE leave_balances
SET allocated_days = 6.0,
    used_days = 6.0,
    pending_days = 0.0,
    updated_at = NOW()
WHERE employee_id = 'emp-1790262001715' AND leave_type_id = 'lt-cl' AND year = 2026;

-- Step 4: Sync Nabila Hussain Casual Leave balance (used=2.5, alloc=3.5, pending=0.0)
UPDATE leave_balances
SET used_days = 2.5,
    allocated_days = GREATEST(allocated_days, 2.5),
    pending_days = 0.0,
    updated_at = NOW()
WHERE employee_id = 'emp-1790251142527' AND leave_type_id = 'lt-cl' AND year = 2026;

-- Step 5: Clean up inactive lt-hdl rows from leave_balances
DELETE FROM leave_balances
WHERE leave_type_id = 'lt-hdl' OR leave_type_id IN (
  SELECT id FROM leave_types WHERE UPPER(code) = 'HDL' OR LOWER(name) = 'half day'
);

