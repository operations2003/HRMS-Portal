-- =====================================================================
-- Migration 034: Add profile photo (avatar_url) to employees and users
-- =====================================================================

ALTER TABLE employees ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
