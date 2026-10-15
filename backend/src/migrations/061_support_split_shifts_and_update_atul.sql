-- =====================================================================
-- Migration 061: Split / Dual Shifts Support & Atul Malhotra Exception
-- Database: Supabase PostgreSQL
-- =====================================================================

-- 1. Add sessions column to attendance_records to support multi-shift / split-shift daily logs
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS sessions JSONB DEFAULT '[]'::jsonb;

-- 2. Configure Atul Malhotra's shift timing exception: 2 login shifts per day (1 PM - 4 PM and 10 PM - 1 AM)
UPDATE employees
SET shift_timing = '01:00 PM - 04:00 PM, 10:00 PM - 01:00 AM',
    updated_at = NOW()
WHERE id = 'emp-1790316917657' OR LOWER(first_name) = 'atul' AND LOWER(last_name) = 'malhotra';

-- 3. Synchronize all active working shift assignments for Atul Malhotra to the dual shift schedule
UPDATE shift_assignments
SET shift_label = '01:00 PM - 04:00 PM, 10:00 PM - 01:00 AM',
    shift_start_time = '13:00:00',
    shift_end_time = '01:00:00',
    is_overnight = TRUE,
    notes = 'Dual Shift (1:00 PM - 4:00 PM & 10:00 PM - 1:00 AM)',
    updated_at = NOW()
WHERE employee_id = 'emp-1790316917657' AND shift_type = 'SHIFT';
