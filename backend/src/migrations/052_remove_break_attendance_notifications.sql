-- =====================================================================
-- Migration 052: Remove break, resume work, and logout notifications
-- Keeps attendance events on their respective operational pages
-- =====================================================================

DELETE FROM notifications
WHERE event_type IN ('EMPLOYEE_ON_BREAK', 'EMPLOYEE_RESUMED_BREAK')
   OR entity_type = 'ATTENDANCE_BREAK'
   OR title ILIKE '%on break%'
   OR title ILIKE '%work resumed%'
   OR title ILIKE '%resumed break%'
   OR title ILIKE '%logged out%'
   OR title ILIKE '%logout%';

DO $$
BEGIN
  RAISE NOTICE 'Purged all break, resume, and logout notifications to eliminate inbox clutter.';
END $$;
