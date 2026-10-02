-- Migration: 053_fix_special_leave_negative_balances.sql
-- Purpose: Fix existing negative balances for the 6 special leave types
-- These leave types should always have 0 balance (allocated=0, used=0, pending=0)
-- Special leaves: Holiday (HL), AWOL, LWP/LOP, Maternity (ML), Sabbatical (SBL), Paternity (PTL/PATL)
-- Date: 2026-09-21

-- ============================================================================
-- STEP 1: Identify and log current negative balances for special leave types
-- ============================================================================

DO $$
DECLARE
  negative_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO negative_count
  FROM leave_balances lb
  JOIN leave_types lt ON lb.leave_type_id = lt.id
  WHERE (lb.allocated_days - lb.used_days - lb.pending_days) < 0
    AND (
      UPPER(TRIM(lt.code)) IN ('HL', 'AWOL', 'LOP', 'LWP', 'ML', 'PTL', 'PATL', 'SBL')
      OR LOWER(TRIM(lt.name)) IN ('holiday', 'absent without leave', 'awol', 'leave without pay', 'loss of pay', 'lop', 'lwp', 'maternity leave', 'maternity', 'sabbatical leave', 'sabbatical', 'paternity leave', 'paternity')
      OR LOWER(lt.name) LIKE '%without pay%'
      OR LOWER(lt.name) LIKE '%maternity%'
      OR LOWER(lt.name) LIKE '%paternity%'
      OR LOWER(lt.name) LIKE '%sabbatical%'
    );

  RAISE NOTICE '==========================================';
  RAISE NOTICE 'SPECIAL LEAVE BALANCE FIX';
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Found % negative balance records for special leave types', negative_count;
  RAISE NOTICE 'These will be reset to 0 (allocated=0, used=0, pending=0)';
  RAISE NOTICE '==========================================';
END $$;

-- ============================================================================
-- STEP 2: Create backup table before making changes
-- ============================================================================

CREATE TEMP TABLE special_leave_balance_backup AS
SELECT 
  lb.id,
  lb.employee_id,
  e.first_name || ' ' || e.last_name as employee_name,
  e.employee_code,
  lb.leave_type_id,
  lt.name as leave_type_name,
  lt.code as leave_type_code,
  lb.year,
  lb.allocated_days as old_allocated_days,
  lb.used_days as old_used_days,
  lb.pending_days as old_pending_days,
  (lb.allocated_days - lb.used_days - lb.pending_days) as old_remaining_days,
  NOW() as backup_timestamp
FROM leave_balances lb
JOIN leave_types lt ON lb.leave_type_id = lt.id
JOIN employees e ON lb.employee_id = e.id
WHERE UPPER(TRIM(lt.code)) IN ('HL', 'AWOL', 'LOP', 'LWP', 'ML', 'PTL', 'PATL', 'SBL')
   OR LOWER(TRIM(lt.name)) IN ('holiday', 'absent without leave', 'awol', 'leave without pay', 'loss of pay', 'lop', 'lwp', 'maternity leave', 'maternity', 'sabbatical leave', 'sabbatical', 'paternity leave', 'paternity')
   OR LOWER(lt.name) LIKE '%without pay%'
   OR LOWER(lt.name) LIKE '%maternity%'
   OR LOWER(lt.name) LIKE '%paternity%'
   OR LOWER(lt.name) LIKE '%sabbatical%';

-- ============================================================================
-- STEP 3: Reset special leave balances to 0
-- ============================================================================

UPDATE leave_balances lb
SET 
  allocated_days = 0.0,
  used_days = 0.0,
  pending_days = 0.0,
  updated_at = NOW()
FROM leave_types lt
WHERE lb.leave_type_id = lt.id
  AND (
    UPPER(TRIM(lt.code)) IN ('HL', 'AWOL', 'LOP', 'LWP', 'ML', 'PTL', 'PATL', 'SBL')
    OR LOWER(TRIM(lt.name)) IN ('holiday', 'absent without leave', 'awol', 'leave without pay', 'loss of pay', 'lop', 'lwp', 'maternity leave', 'maternity', 'sabbatical leave', 'sabbatical', 'paternity leave', 'paternity')
    OR LOWER(lt.name) LIKE '%without pay%'
    OR LOWER(lt.name) LIKE '%maternity%'
    OR LOWER(lt.name) LIKE '%paternity%'
    OR LOWER(lt.name) LIKE '%sabbatical%'
  );

-- ============================================================================
-- STEP 4: Report summary of changes
-- ============================================================================

DO $$
DECLARE
  total_fixed INTEGER;
  negative_fixed INTEGER;
  employees_affected INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_fixed FROM special_leave_balance_backup;
  
  SELECT COUNT(*) INTO negative_fixed 
  FROM special_leave_balance_backup 
  WHERE old_remaining_days < 0;
  
  SELECT COUNT(DISTINCT employee_id) INTO employees_affected 
  FROM special_leave_balance_backup;

  RAISE NOTICE '==========================================';
  RAISE NOTICE 'SPECIAL LEAVE BALANCE FIX - SUMMARY';
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Total special leave balance records reset: %', total_fixed;
  RAISE NOTICE 'Records that were negative: %', negative_fixed;
  RAISE NOTICE 'Employees affected: %', employees_affected;
  RAISE NOTICE '';
  RAISE NOTICE 'All special leave balances now set to:';
  RAISE NOTICE '  - Allocated Days: 0';
  RAISE NOTICE '  - Used Days: 0';
  RAISE NOTICE '  - Pending Days: 0';
  RAISE NOTICE '  - Remaining Days: 0';
  RAISE NOTICE '';
  RAISE NOTICE 'Historical leave requests remain intact and unchanged.';
  RAISE NOTICE 'Backup data stored in temp table: special_leave_balance_backup';
  RAISE NOTICE 'Query backup: SELECT * FROM special_leave_balance_backup ORDER BY employee_name;';
  RAISE NOTICE '==========================================';
END $$;

-- ============================================================================
-- STEP 5: Add database constraint to prevent future negative special leaves
-- ============================================================================

-- Note: We cannot add a CHECK constraint because we need to identify special leaves dynamically
-- The application logic now handles this through:
-- 1. recordAssignedLeaveBalance() - keeps special leaves at 0
-- 2. initializeBalancesForEmployee() - initializes special leaves with allocated=0
-- 3. Frontend - hides special leaves from employee self-application

-- ============================================================================
-- STEP 6: Document the change
-- ============================================================================

COMMENT ON COLUMN leave_balances.allocated_days IS 
  'Total days allocated for this leave type. For special leaves (HL, AWOL, LWP, ML, SBL, PTL), this is always 0. For normal leaves, set by HR/Admin or system default.';

COMMENT ON COLUMN leave_balances.used_days IS 
  'Days consumed through APPROVED leave requests. For special leaves, this remains 0 (tracked separately). For normal leaves, deducted from allocation.';

-- ============================================================================
-- VERIFICATION QUERIES (for manual review after migration)
-- ============================================================================

-- Check all special leave balances are now at 0:
-- SELECT 
--   e.employee_code,
--   e.first_name || ' ' || e.last_name as employee_name,
--   lt.name as leave_type,
--   lt.code,
--   lb.allocated_days,
--   lb.used_days,
--   lb.pending_days,
--   (lb.allocated_days - lb.used_days - lb.pending_days) as remaining_days
-- FROM leave_balances lb
-- JOIN leave_types lt ON lb.leave_type_id = lt.id
-- JOIN employees e ON lb.employee_id = e.id
-- WHERE UPPER(TRIM(lt.code)) IN ('HL', 'AWOL', 'LOP', 'LWP', 'ML', 'PTL', 'PATL', 'SBL')
-- ORDER BY e.employee_code, lt.name;

-- Check leave requests for special leave types are preserved:
-- SELECT 
--   lr.id,
--   e.first_name || ' ' || e.last_name as employee_name,
--   lt.name as leave_type,
--   lt.code,
--   lr.start_date,
--   lr.end_date,
--   lr.total_days,
--   lr.status,
--   lr.created_at
-- FROM leave_requests lr
-- JOIN leave_types lt ON lr.leave_type_id = lt.id
-- JOIN employees e ON lr.employee_id = e.id
-- WHERE UPPER(TRIM(lt.code)) IN ('HL', 'AWOL', 'LOP', 'LWP', 'ML', 'PTL', 'PATL', 'SBL')
-- ORDER BY lr.created_at DESC
-- LIMIT 20;

-- ============================================================================
-- IMPORTANT NOTES
-- ============================================================================

-- 1. This migration ONLY fixes balance records, not leave request records
-- 2. Historical leave requests remain unchanged and visible
-- 3. Future special leave assignments will not deduct from balance (handled by code)
-- 4. Employees cannot self-apply for special leaves (enforced in frontend and backend)
-- 5. Only Admin, HR, and Reporting Managers can assign special leaves
-- 6. The backup table is temporary and will be cleared on database restart

SELECT 1 as migration_053_complete;
