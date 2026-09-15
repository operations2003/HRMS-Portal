-- =====================================================================
-- Migration 002: Seed Base Organizations for Phase 1
-- Database: Supabase PostgreSQL 17+
-- =====================================================================

INSERT INTO organizations (id, name, code, email, phone, website, address, status, created_at, updated_at)
VALUES 
  ('org-1', 'TechCorp Solutions', 'TCORP', 'contact@techcorp.com', '+1 (555) 019-2834', 'https://techcorp.example.com', '100 Innovation Way, Suite 400, San Francisco, CA', 'Active', '2026-01-10 08:00:00+00', '2026-01-10 08:00:00+00'),
  ('org-2', 'Apex Global Logistics', 'APEX', 'info@apexlogistics.com', '+1 (555) 482-9102', 'https://apexlogistics.example.com', '450 Harbor Boulevard, Newark, NJ', 'Active', '2026-02-15 09:30:00+00', '2026-02-15 09:30:00+00'),
  ('org-3', 'Horizon Health Systems', 'HORIZON', 'support@horizonhealth.org', '+1 (555) 739-1122', 'https://horizonhealth.example.org', '782 Medical Center Drive, Chicago, IL', 'Inactive', '2026-03-01 11:00:00+00', '2026-03-01 11:00:00+00')
ON CONFLICT (code) DO NOTHING;

