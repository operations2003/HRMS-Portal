-- Migration: 064_purge_all_preseeded_holidays.sql
-- Description: Remove all system-seeded holidays from the holidays table.
--   Per company policy, holidays are NOT sourced from the Indian national calendar
--   or any pre-defined list. Holidays are declared exclusively by the CEO
--   (Sheetal Bedi) through the Company Holiday Management section.
--   This migration removes all previously seeded holidays and ensures a clean slate.

DELETE FROM holidays;

