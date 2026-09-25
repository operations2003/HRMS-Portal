-- 040_remove_unplanned_leave.sql
-- Completely remove Unplanned Leave (UPL) from HRMS database

-- 1. Delete leave balances associated with UPL
DELETE FROM leave_balances 
WHERE leave_type_id IN (
  SELECT id FROM leave_types 
  WHERE code = 'UPL' OR UPPER(name) = 'UNPLANNED LEAVE' OR id = 'lt-upl'
);

-- 2. Delete any leave requests associated with UPL (if any)
DELETE FROM leave_requests 
WHERE leave_type_id IN (
  SELECT id FROM leave_types 
  WHERE code = 'UPL' OR UPPER(name) = 'UNPLANNED LEAVE' OR id = 'lt-upl'
);

-- 3. Delete the leave type itself completely
DELETE FROM leave_types 
WHERE code = 'UPL' OR UPPER(name) = 'UNPLANNED LEAVE' OR id = 'lt-upl';
