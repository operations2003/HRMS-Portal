-- 045_add_date_decisions_to_leave_requests.sql
-- Add date_decisions JSONB column to leave_requests to support date-wise approvals and tracking

ALTER TABLE leave_requests
ADD COLUMN IF NOT EXISTS date_decisions JSONB DEFAULT '[]'::jsonb;

-- Create an index on date_decisions for fast json querying
CREATE INDEX IF NOT EXISTS idx_leave_requests_date_decisions ON leave_requests USING gin (date_decisions);
