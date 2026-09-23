-- =====================================================================
-- Migration 037: Global Attendance Working Duration & Overtime Normalization
-- Database: Supabase PostgreSQL 17+
-- =====================================================================

-- 1. Correct specific anomaly where checkout was mistakenly recorded 12h later on next morning
UPDATE attendance_records
SET check_out = '2026-09-22 18:04:33.098+00'::timestamptz
WHERE id = 'att-1790063482581-191'
  AND check_out = '2026-09-23 06:04:33.098+00'::timestamptz;

-- 2. Recalculate total_hours accurately as (check_out - check_in) - break_duration
UPDATE attendance_records a
SET 
  total_hours = GREATEST(
    0.00,
    ROUND(
      ((EXTRACT(EPOCH FROM (a.check_out - a.check_in)) - (COALESCE(a.break_duration_minutes, 0) * 60)) / 3600.0)::numeric,
      2
    )
  )
WHERE a.check_in IS NOT NULL 
  AND a.check_out IS NOT NULL 
  AND a.check_out >= a.check_in;

-- 3. Recalculate overtime_hours based strictly on each employee's assigned shift duration
UPDATE attendance_records a
SET overtime_hours = GREATEST(
  0.00,
  ROUND(
    (a.total_hours - (
      CASE 
        WHEN e.shift_timing ILIKE '%01:00 AM%07:00 PM%' OR e.shift_timing ILIKE '%1:00 AM%7:00 PM%' THEN 18.00
        WHEN e.shift_timing ILIKE '%06:08 PM%07:00 AM%' OR e.shift_timing ILIKE '%6:08 PM%7:00 AM%' THEN 12.87
        WHEN e.shift_timing ILIKE '%09:30 AM%06:30 PM%' OR e.shift_timing ILIKE '%9:30 AM%6:30 PM%' THEN 9.00
        ELSE 8.00
      END
    ))::numeric,
    2
  )
)
FROM employees e
WHERE e.id = a.employee_id
  AND a.check_out IS NOT NULL
  AND a.status != 'REGULARIZED_VOID_OT';
