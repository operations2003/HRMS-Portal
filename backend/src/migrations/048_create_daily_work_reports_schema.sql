-- Migration 048: Create Daily Work Reports Schema
-- Allows employees to submit daily work summaries and logs of what they accomplished,
-- and allows Managers, HR, and Admin to view, track compliance, and acknowledge reports.

CREATE TABLE IF NOT EXISTS daily_work_reports (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    report_date DATE NOT NULL DEFAULT CURRENT_DATE,
    work_summary TEXT NOT NULL,
    tasks_completed TEXT,
    blockers TEXT,
    plan_for_tomorrow TEXT,
    hours_worked NUMERIC(5,2) DEFAULT 8.0,
    mood_or_status VARCHAR(50) DEFAULT 'PRODUCTIVE',
    status VARCHAR(50) DEFAULT 'SUBMITTED',
    manager_feedback TEXT,
    reviewed_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_daily_work_reports_employee_date UNIQUE (employee_id, report_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_work_reports_org_date ON daily_work_reports(org_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_work_reports_emp_date ON daily_work_reports(employee_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_work_reports_status ON daily_work_reports(status);
