-- =====================================================================
-- Migration 056: AppSumo Licensing v2 Integration Schema
-- Database: PostgreSQL 17+
-- =====================================================================

-- 1. AppSumo Licenses Table
CREATE TABLE IF NOT EXISTS appsumo_licenses (
    id VARCHAR(64) PRIMARY KEY,
    license_key VARCHAR(255) NOT NULL UNIQUE,
    prev_license_key VARCHAR(255),
    organization_id VARCHAR(64) REFERENCES organizations(id) ON DELETE SET NULL,
    activated_by_user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    tier INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(50) NOT NULL DEFAULT 'inactive', -- 'active', 'inactive', 'deactivated'
    event VARCHAR(50) NOT NULL DEFAULT 'purchase',  -- 'purchase', 'activate', 'upgrade', 'downgrade', 'migrate', 'deactivate'
    partner_plan_name VARCHAR(255) DEFAULT 'TaskNera AppSumo Plan',
    unit_quantity INTEGER NOT NULL DEFAULT 1,
    parent_license_key VARCHAR(255),
    is_test BOOLEAN NOT NULL DEFAULT FALSE,
    raw_details JSONB DEFAULT '{}'::jsonb,
    last_event_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for updated_at on appsumo_licenses
DROP TRIGGER IF EXISTS trg_appsumo_licenses_updated_at ON appsumo_licenses;
CREATE TRIGGER trg_appsumo_licenses_updated_at
BEFORE UPDATE ON appsumo_licenses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Indexes for AppSumo Licenses
CREATE INDEX IF NOT EXISTS idx_appsumo_licenses_key ON appsumo_licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_appsumo_licenses_org ON appsumo_licenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_appsumo_licenses_prev_key ON appsumo_licenses(prev_license_key);
CREATE INDEX IF NOT EXISTS idx_appsumo_licenses_status ON appsumo_licenses(status);
CREATE INDEX IF NOT EXISTS idx_appsumo_licenses_tier ON appsumo_licenses(tier);

-- 2. AppSumo License Webhook & Audit Events Table
CREATE TABLE IF NOT EXISTS appsumo_license_events (
    id VARCHAR(64) PRIMARY KEY,
    license_id VARCHAR(64) REFERENCES appsumo_licenses(id) ON DELETE SET NULL,
    license_key VARCHAR(255) NOT NULL,
    prev_license_key VARCHAR(255),
    event VARCHAR(50) NOT NULL,
    tier INTEGER,
    license_status VARCHAR(50),
    event_timestamp BIGINT,
    created_at_from_appsumo BIGINT,
    test BOOLEAN NOT NULL DEFAULT FALSE,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    processed BOOLEAN NOT NULL DEFAULT TRUE,
    processing_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for AppSumo License Events
CREATE INDEX IF NOT EXISTS idx_appsumo_events_key ON appsumo_license_events(license_key);
CREATE INDEX IF NOT EXISTS idx_appsumo_events_license_id ON appsumo_license_events(license_id);
CREATE INDEX IF NOT EXISTS idx_appsumo_events_event ON appsumo_license_events(event);
CREATE INDEX IF NOT EXISTS idx_appsumo_events_created ON appsumo_license_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appsumo_events_test ON appsumo_license_events(test);
