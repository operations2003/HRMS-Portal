-- =====================================================================
-- Migration 049: Clean Up LWP/LOP Attendance Records
-- Purpose: Remove attendance records for Leave Without Pay (LWP) leaves
--          as these should not appear in attendance tracking
-- =====================================================================

-- Remove attendance records created from LWP/LOP leave assignments
-- These leaves should not be reflected in attendance as they will be
-- processed separately as unpaid leave deductions

DELETE FROM attendance_records 
WHERE source = 'LEAVE_ASSIGNMENT'
  AND (
    notes ILIKE '%Leave Without Pay%'
    OR notes ILIKE '%LWP%'
    OR notes ILIKE '%LOP%'
    OR notes ILIKE '%Loss of Pay%'
  );

-- Log the cleanup
DO $$
DECLARE
  deleted_count INT;
BEGIN
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Cleaned up % LWP/LOP attendance records', deleted_count;
END $$;
