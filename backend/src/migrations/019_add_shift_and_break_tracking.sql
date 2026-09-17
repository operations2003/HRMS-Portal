-- =====================================================================
-- Migration 019: Shift Timing and Break Tracking
-- Database: Supabase PostgreSQL
-- =====================================================================

-- 1. Add shift_timing to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS shift_timing VARCHAR(100) DEFAULT '11:00 AM - 07:00 PM';

-- 2. Add break tracking columns to attendance_records
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS is_on_break BOOLEAN DEFAULT FALSE;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS current_break_start TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS break_history JSONB DEFAULT '[]'::jsonb;
