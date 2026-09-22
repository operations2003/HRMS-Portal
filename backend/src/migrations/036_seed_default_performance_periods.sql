-- =====================================================================
-- Migration 036: Seed Default Performance Review Periods (6 Months & 12 Months)
-- Database: Supabase PostgreSQL 17+
-- =====================================================================

INSERT INTO performance_periods (
  id,
  org_id,
  name,
  code,
  period_type,
  start_date,
  end_date,
  due_date,
  status,
  created_at,
  updated_at
)
SELECT
  'period-6-months',
  o.id,
  '6 Months',
  '6-MONTHS',
  'MID_YEAR',
  DATE_TRUNC('year', CURRENT_DATE)::DATE,
  (DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '6 months - 1 day')::DATE,
  (DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '7 months')::DATE,
  'ACTIVE',
  NOW(),
  NOW()
FROM organizations o
ON CONFLICT (org_id, code) DO NOTHING;

INSERT INTO performance_periods (
  id,
  org_id,
  name,
  code,
  period_type,
  start_date,
  end_date,
  due_date,
  status,
  created_at,
  updated_at
)
SELECT
  'period-12-months',
  o.id,
  '12 Months',
  '12-MONTHS',
  'ANNUAL',
  DATE_TRUNC('year', CURRENT_DATE)::DATE,
  (DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year - 1 day')::DATE,
  (DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year 15 days')::DATE,
  'ACTIVE',
  NOW(),
  NOW()
FROM organizations o
ON CONFLICT (org_id, code) DO NOTHING;
