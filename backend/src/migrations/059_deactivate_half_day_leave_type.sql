-- Migration 059: Deactivate Half Day Leave Type
-- Half Day is not a standalone leave category. When employees take a half day,
-- it is treated as a 0.5-day duration applied to and deducted from Casual Leave (CL).

UPDATE leave_types 
SET status = 'Inactive', updated_at = NOW()
WHERE code = 'HDL' OR id = 'lt-hdl' OR LOWER(name) = 'half day';
