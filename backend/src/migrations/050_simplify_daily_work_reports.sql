-- =====================================================================
-- Migration 050: Simplify Daily Work Reports Schema
-- Remove unnecessary fields, keep only date and summary
-- =====================================================================

-- Remove columns that are no longer needed
ALTER TABLE daily_work_reports 
  DROP COLUMN IF EXISTS tasks_completed,
  DROP COLUMN IF EXISTS blockers,
  DROP COLUMN IF EXISTS plan_for_tomorrow,
  DROP COLUMN IF EXISTS hours_worked,
  DROP COLUMN IF EXISTS mood_or_status;

-- Update the work_summary column to allow longer text
ALTER TABLE daily_work_reports 
  ALTER COLUMN work_summary TYPE TEXT;

-- Log the changes
DO $$
BEGIN
  RAISE NOTICE 'Simplified daily_work_reports table to contain only date and summary fields';
END $$;
