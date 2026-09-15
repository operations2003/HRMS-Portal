-- =====================================================================
-- Migration 006: Phase 3 Onboarding & Document Vault Schema
-- Database: Supabase PostgreSQL 17+
-- =====================================================================

-- 1. New Hires Table (Full Lifecycle State Tracking)
CREATE TABLE IF NOT EXISTS new_hires (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    ats_candidate_id VARCHAR(100) NOT NULL,
    ats_job_id VARCHAR(100) DEFAULT '',
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) DEFAULT '',
    date_of_joining DATE NOT NULL,
    dept_id VARCHAR(64) REFERENCES departments(id) ON DELETE SET NULL,
    desig_id VARCHAR(64) REFERENCES designations(id) ON DELETE SET NULL,
    manager_id VARCHAR(64) REFERENCES employees(id) ON DELETE SET NULL,
    location VARCHAR(255) DEFAULT '',
    lifecycle_state VARCHAR(50) NOT NULL DEFAULT 'NEW_HIRE', -- OFFERED, NEW_HIRE, ONBOARDING, CONVERTED_TO_EMPLOYEE, REJECTED, WITHDRAWN
    onboarding_status VARCHAR(50) NOT NULL DEFAULT 'NOT_STARTED', -- NOT_STARTED, IN_PROGRESS, DOCUMENTATION_PENDING, VERIFICATION_PENDING, READY_FOR_JOINING, COMPLETED
    bgv_status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, INITIATED, IN_PROGRESS, CLEAR, RED_FLAG, WAIVED
    readiness_tracker JSONB NOT NULL DEFAULT '{
      "itSetup": false,
      "workstationReady": false,
      "welcomeKitDispatched": false,
      "idCardGenerated": false,
      "orientationScheduled": false,
      "completionPercentage": 0
    }'::jsonb,
    national_id_type VARCHAR(50) DEFAULT 'PAN',
    national_id_number TEXT,
    national_id_hash VARCHAR(64),
    employee_id VARCHAR(64) REFERENCES employees(id) ON DELETE SET NULL,
    raw_ats_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_new_hires_org_ats UNIQUE (org_id, ats_candidate_id),
    CONSTRAINT uk_new_hires_org_email UNIQUE (org_id, email)
);

-- Trigger for new_hires updated_at
DROP TRIGGER IF EXISTS trg_new_hires_updated_at ON new_hires;
CREATE TRIGGER trg_new_hires_updated_at
BEFORE UPDATE ON new_hires
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Unique partial index for national_id_hash per org (allows nulls but prevents duplicate PAN/SSN)
CREATE UNIQUE INDEX IF NOT EXISTS idx_uk_new_hires_org_national_hash
ON new_hires (org_id, national_id_hash)
WHERE national_id_hash IS NOT NULL AND national_id_hash <> '';

-- Performance indexes for new_hires
CREATE INDEX IF NOT EXISTS idx_new_hires_org_id ON new_hires(org_id);
CREATE INDEX IF NOT EXISTS idx_new_hires_lifecycle_state ON new_hires(lifecycle_state);
CREATE INDEX IF NOT EXISTS idx_new_hires_onboarding_status ON new_hires(onboarding_status);
CREATE INDEX IF NOT EXISTS idx_new_hires_bgv_status ON new_hires(bgv_status);
CREATE INDEX IF NOT EXISTS idx_new_hires_dept_id ON new_hires(dept_id);
CREATE INDEX IF NOT EXISTS idx_new_hires_employee_id ON new_hires(employee_id);
CREATE INDEX IF NOT EXISTS idx_new_hires_email ON new_hires(email);


-- 2. Document Vault Table (Document Data Structure & Lifecycle Verification)
CREATE TABLE IF NOT EXISTS document_vault (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    owner_type VARCHAR(50) NOT NULL DEFAULT 'NEW_HIRE', -- NEW_HIRE, EMPLOYEE, CANDIDATE
    owner_id VARCHAR(64) NOT NULL, -- ID of new_hire or employee
    category VARCHAR(100) NOT NULL, -- IDENTITY, TAX, EDUCATION, OFFER, EXPERIENCE, MEDICAL, OTHER
    document_type VARCHAR(100) NOT NULL, -- PAN_CARD, AADHAAR, PASSPORT, OFFER_LETTER, DEGREE_CERTIFICATE, etc.
    title VARCHAR(255) NOT NULL,
    version INT NOT NULL DEFAULT 1,
    file_url TEXT NOT NULL,
    file_size INT DEFAULT 0,
    mime_type VARCHAR(100) DEFAULT 'application/pdf',
    verification_status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
    verified_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    rejection_reason TEXT DEFAULT '',
    expiry_date DATE,
    acknowledgement_log JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of { acknowledged_by, timestamp, ip_address, user_agent }
    is_encrypted BOOLEAN DEFAULT FALSE,
    encryption_metadata JSONB DEFAULT '{}'::jsonb, -- { algorithm, key_id, iv, tag }
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for document_vault updated_at
DROP TRIGGER IF EXISTS trg_document_vault_updated_at ON document_vault;
CREATE TRIGGER trg_document_vault_updated_at
BEFORE UPDATE ON document_vault
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Indexes for Document Vault
CREATE INDEX IF NOT EXISTS idx_doc_vault_owner ON document_vault(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_doc_vault_org_id ON document_vault(org_id);
CREATE INDEX IF NOT EXISTS idx_doc_vault_verification_status ON document_vault(verification_status);
CREATE INDEX IF NOT EXISTS idx_doc_vault_category ON document_vault(category);
CREATE INDEX IF NOT EXISTS idx_doc_vault_document_type ON document_vault(document_type);


-- 3. Seed Permissions for Onboarding & ATS Integration
INSERT INTO permissions (id, code, name, module, description, created_at, updated_at)
VALUES
  ('perm-doc-read', 'document:read', 'View Documents', 'document', 'View document vault files and metadata', NOW(), NOW()),
  ('perm-doc-write', 'document:write', 'Manage Documents', 'document', 'Upload, verify and manage documents in vault', NOW(), NOW()),
  ('perm-ats-integrate', 'ats:integrate', 'ATS Integration Handoff', 'integration', 'Ingest ATS candidate handoff payloads', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

-- Map new permissions to Roles (ADMIN, SuperAdmin, HR, HRManager, MANAGER)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE 
  -- ADMIN & SuperAdmin have all permissions
  (r.name IN ('ADMIN', 'SuperAdmin') AND p.code IN (
    'onboarding:read', 'onboarding:write', 'onboarding:verify', 'document:read', 'document:write', 'ats:integrate'
  ))
  -- HR & HRManager have onboarding, document permissions and ats handoff
  OR (r.name IN ('HR', 'HRManager') AND p.code IN (
    'onboarding:read', 'onboarding:write', 'onboarding:verify', 'document:read', 'document:write', 'ats:integrate'
  ))
  -- MANAGER can view onboarding and documents
  OR (r.name = 'MANAGER' AND p.code IN (
    'onboarding:read', 'document:read'
  ))
ON CONFLICT (role_id, permission_id) DO NOTHING;

