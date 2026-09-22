-- ================================================================
-- 035_add_task_rating_and_review.sql
-- Add rating, review feedback, and reopen tracking to work_tasks
-- ================================================================

ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS rating NUMERIC(3,1) CHECK (rating >= 1 AND rating <= 5);
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS rating_feedback TEXT;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS rated_by VARCHAR(50) REFERENCES employees(id);
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS rated_at TIMESTAMPTZ;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS reopen_count INT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_work_tasks_rating ON work_tasks(rating);
