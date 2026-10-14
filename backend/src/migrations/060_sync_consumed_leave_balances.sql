-- Migration: 060_sync_consumed_leave_balances.sql
-- Purpose: Accurately sync and track consumed leave days (including LWP, LOP, and all approved leaves) in leave_balances.
-- Ensures that if anyone has consumed leaves like LWP, their used_days accurately reflects the consumed days in their leave bucket.

-- Step 1: Ensure missing balance rows exist for any employee with approved leave requests
INSERT INTO leave_balances (
  id, org_id, employee_id, leave_type_id, year, allocated_days, used_days, pending_days, created_at, updated_at
)
SELECT
  'lb-' || lr.employee_id || '-' || lr.leave_type_id || '-' || EXTRACT(YEAR FROM lr.start_date)::int AS id,
  lr.org_id,
  lr.employee_id,
  lr.leave_type_id,
  EXTRACT(YEAR FROM lr.start_date)::int AS year,
  SUM(lr.total_days) AS allocated_days,
  SUM(lr.total_days) AS used_days,
  0.0 AS pending_days,
  NOW() AS created_at,
  NOW() AS updated_at
FROM leave_requests lr
WHERE lr.status = 'APPROVED'
GROUP BY lr.org_id, lr.employee_id, lr.leave_type_id, EXTRACT(YEAR FROM lr.start_date)
ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;

-- Step 2: Update existing leave_balances so used_days reflects the actual consumed (approved) days
UPDATE leave_balances lb
SET used_days = approved_sub.total_approved,
    allocated_days = GREATEST(lb.allocated_days, approved_sub.total_approved),
    updated_at = NOW()
FROM (
  SELECT
    lr.employee_id,
    lr.leave_type_id,
    EXTRACT(YEAR FROM lr.start_date)::int AS year,
    SUM(lr.total_days) AS total_approved
  FROM leave_requests lr
  WHERE lr.status = 'APPROVED'
  GROUP BY lr.employee_id, lr.leave_type_id, EXTRACT(YEAR FROM lr.start_date)
) approved_sub
WHERE lb.employee_id = approved_sub.employee_id
  AND lb.leave_type_id = approved_sub.leave_type_id
  AND lb.year = approved_sub.year
  AND lb.used_days < approved_sub.total_approved;
