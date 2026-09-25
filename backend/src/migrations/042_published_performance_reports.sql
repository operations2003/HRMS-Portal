-- Migration 042: Published Performance Reports Table
-- Handles individual performance reports sent to specific employees with re-send capabilities

CREATE TABLE IF NOT EXISTS published_performance_reports (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    employee_user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    sender_id VARCHAR(64) REFERENCES employees(id) ON DELETE SET NULL,
    sender_user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    department VARCHAR(100) NOT NULL DEFAULT 'operations',
    employee_name VARCHAR(255) NOT NULL,
    employee_code VARCHAR(64) DEFAULT '',
    designation VARCHAR(255) DEFAULT '',
    review_period VARCHAR(100) DEFAULT '',
    review_date DATE DEFAULT CURRENT_DATE,
    review_cycle VARCHAR(100) DEFAULT 'Quarterly Review',
    average_score NUMERIC(4, 2) DEFAULT 0.00,
    overall_rating VARCHAR(100) DEFAULT 'Meets Expectations',
    report_data JSONB NOT NULL,
    sent_count INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(50) NOT NULL DEFAULT 'DELIVERED' CHECK (status IN ('DELIVERED', 'DELETED_BY_USER')),
    deleted_by_user_at TIMESTAMPTZ DEFAULT NULL,
    last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pub_perf_reports_org ON published_performance_reports(org_id);
CREATE INDEX IF NOT EXISTS idx_pub_perf_reports_emp ON published_performance_reports(employee_id);
CREATE INDEX IF NOT EXISTS idx_pub_perf_reports_user ON published_performance_reports(employee_user_id);
CREATE INDEX IF NOT EXISTS idx_pub_perf_reports_status ON published_performance_reports(status);
