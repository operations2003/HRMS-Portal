-- =====================================================================
-- Migration 051: Exclude CEO / Administrator from Attendance System
-- Purge any past attendance records for CEO / Administrator
-- =====================================================================

DELETE FROM attendance_records 
WHERE employee_id IN (
  SELECT e.id 
  FROM employees e
  LEFT JOIN users u ON u.id = e.user_id
  LEFT JOIN roles r ON r.id = u.role_id
  LEFT JOIN designations ds ON ds.id = e.desig_id
  WHERE e.desig_id = 'desig-ceo'
     OR UPPER(COALESCE(ds.code, '')) = 'CEO'
     OR LOWER(COALESCE(ds.title, '')) LIKE '%ceo%'
     OR LOWER(COALESCE(ds.title, '')) LIKE '%chief executive officer%'
     OR LOWER(COALESCE(r.name, '')) IN ('admin', 'superadmin', 'orgadmin')
);

DO $$
BEGIN
  RAISE NOTICE 'Purged attendance records for CEO / Administrator.';
END $$;
