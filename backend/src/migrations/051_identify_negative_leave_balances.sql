-- Migration: 051_identify_negative_leave_balances.sql
-- Purpose: Identify and report employees with negative leave balances for HR/Admin review
-- This migration does NOT automatically fix negative balances - it creates a report for manual review
-- Date: 2026-09-21

-- Create a temporary report table to track negative balance issues
CREATE TABLE IF NOT EXISTS negative_leave_balance_report (
  id SERIAL PRIMARY KEY,
  employee_id VARCHAR(255) NOT NULL,
  employee_name VARCHAR(500),
  employee_code VARCHAR(100),
  leave_type_id VARCHAR(255) NOT NULL,
  leave_type_name VARCHAR(255),
  leave_type_code VARCHAR(50),
  year INTEGER NOT NULL,
  allocated_days DECIMAL(10, 2) DEFAULT 0,
  used_days DECIMAL(10, 2) DEFAULT 0,
  pending_days DECIMAL(10, 2) DEFAULT 0,
  remaining_days DECIMAL(10, 2) DEFAULT 0,
  severity VARCHAR(50), -- 'CRITICAL' (< -5), 'HIGH' (< -2), 'MODERATE' (< 0)
  detected_at TIMESTAMP DEFAULT NOW(),
  notes TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,
  resolved_by VARCHAR(255)
);

-- Insert current negative balances into the report
INSERT INTO negative_leave_balance_report (
  employee_id,
  employee_name,
  employee_code,
  leave_type_id,
  leave_type_name,
  leave_type_code,
  year,
  allocated_days,
  used_days,
  pending_days,
  remaining_days,
  severity,
  notes
)
SELECT 
  lb.employee_id,
  CONCAT(e.first_name, ' ', e.last_name) as employee_name,
  e.employee_code,
  lb.leave_type_id,
  lt.name as leave_type_name,
  lt.code as leave_type_code,
  lb.year,
  lb.allocated_days,
  lb.used_days,
  lb.pending_days,
  (lb.allocated_days - lb.used_days - lb.pending_days) as remaining_days,
  CASE 
    WHEN (lb.allocated_days - lb.used_days - lb.pending_days) < -5 THEN 'CRITICAL'
    WHEN (lb.allocated_days - lb.used_days - lb.pending_days) < -2 THEN 'HIGH'
    ELSE 'MODERATE'
  END as severity,
  CONCAT(
    'Negative balance detected: ',
    'Allocated=', lb.allocated_days, ', ',
    'Used=', lb.used_days, ', ',
    'Pending=', lb.pending_days, '. ',
    'This may be due to manual adjustments, data migration issues, or concurrent approval race conditions. ',
    'Review leave request history for this employee and leave type.'
  ) as notes
FROM leave_balances lb
JOIN employees e ON lb.employee_id = e.id
JOIN leave_types lt ON lb.leave_type_id = lt.id
WHERE (lb.allocated_days - lb.used_days - lb.pending_days) < 0
ORDER BY 
  (lb.allocated_days - lb.used_days - lb.pending_days) ASC, -- Most negative first
  lb.year DESC,
  e.last_name,
  e.first_name;

-- Create an index for quick lookups
CREATE INDEX IF NOT EXISTS idx_negative_balance_report_employee 
  ON negative_leave_balance_report(employee_id);

CREATE INDEX IF NOT EXISTS idx_negative_balance_report_severity 
  ON negative_leave_balance_report(severity);

CREATE INDEX IF NOT EXISTS idx_negative_balance_report_resolved 
  ON negative_leave_balance_report(resolved);

-- Add a comment to the table for documentation
COMMENT ON TABLE negative_leave_balance_report IS 'Tracks employees with negative leave balances for HR/Admin review and resolution. Records are flagged by severity: CRITICAL (< -5 days), HIGH (< -2 days), MODERATE (< 0 days). HR/Admin should investigate and manually adjust balances after verifying leave request history.';

-- Output summary for migration log
DO $$
DECLARE
  total_negative_records INTEGER;
  critical_count INTEGER;
  high_count INTEGER;
  moderate_count INTEGER;
  affected_employees INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_negative_records FROM negative_leave_balance_report WHERE resolved = FALSE;
  SELECT COUNT(*) INTO critical_count FROM negative_leave_balance_report WHERE severity = 'CRITICAL' AND resolved = FALSE;
  SELECT COUNT(*) INTO high_count FROM negative_leave_balance_report WHERE severity = 'HIGH' AND resolved = FALSE;
  SELECT COUNT(*) INTO moderate_count FROM negative_leave_balance_report WHERE severity = 'MODERATE' AND resolved = FALSE;
  SELECT COUNT(DISTINCT employee_id) INTO affected_employees FROM negative_leave_balance_report WHERE resolved = FALSE;

  RAISE NOTICE '==========================================';
  RAISE NOTICE 'NEGATIVE LEAVE BALANCE REPORT SUMMARY';
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Total negative balance records: %', total_negative_records;
  RAISE NOTICE '  - CRITICAL severity (< -5 days): %', critical_count;
  RAISE NOTICE '  - HIGH severity (< -2 days): %', high_count;
  RAISE NOTICE '  - MODERATE severity (< 0 days): %', moderate_count;
  RAISE NOTICE 'Affected employees: %', affected_employees;
  RAISE NOTICE '==========================================';
  
  IF total_negative_records > 0 THEN
    RAISE NOTICE 'ACTION REQUIRED: Negative leave balances detected!';
    RAISE NOTICE 'HR/Admin should review table: negative_leave_balance_report';
    RAISE NOTICE 'Query: SELECT * FROM negative_leave_balance_report WHERE resolved = FALSE ORDER BY severity DESC, remaining_days ASC;';
    RAISE NOTICE '';
    RAISE NOTICE 'IMPORTANT: The new leave validation system will now prevent new negative balances.';
    RAISE NOTICE 'Existing negative balances must be manually reviewed and corrected by HR/Admin.';
    RAISE NOTICE 'Do NOT automatically reset balances without investigating the root cause.';
  ELSE
    RAISE NOTICE 'No negative leave balances found. System is healthy!';
  END IF;
  RAISE NOTICE '==========================================';
END $$;

-- INSTRUCTIONS FOR HR/ADMIN:
-- 
-- To review negative balances:
--   SELECT * FROM negative_leave_balance_report 
--   WHERE resolved = FALSE 
--   ORDER BY severity DESC, remaining_days ASC;
--
-- To mark a balance issue as resolved after manual correction:
--   UPDATE negative_leave_balance_report 
--   SET resolved = TRUE, resolved_at = NOW(), resolved_by = 'admin@hrms.local'
--   WHERE employee_id = 'emp-xxx' AND leave_type_id = 'lt-xxx' AND year = 2026;
--
-- To manually correct a negative balance (example - adjust carefully):
--   UPDATE leave_balances 
--   SET used_days = 10.0, notes = 'Corrected negative balance - verified leave history'
--   WHERE employee_id = 'emp-xxx' AND leave_type_id = 'lt-xxx' AND year = 2026;
--
-- IMPORTANT: Always investigate the root cause before correcting balances!
-- Check leave_requests table for this employee/leave type to verify used days.
