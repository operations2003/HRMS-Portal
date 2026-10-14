-- Migration: 058_deactivate_indian_holidays.sql
-- Description: Company operates on US calendar (Sunday only off, 6-day work week Mon-Sat).
-- Deactivates Indian national holidays (Gandhi Jayanti, Republic Day, Independence Day) so normal working shifts remain intact.

UPDATE holidays
SET status = 'Inactive', updated_at = NOW()
WHERE name IN ('Gandhi Jayanti', 'Republic Day', 'Independence Day')
   OR id IN ('hol-2026-02', 'hol-2026-04', 'hol-2026-05');
