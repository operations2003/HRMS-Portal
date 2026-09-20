-- =====================================================================
-- Migration 027: Enterprise Document Vault Direct Binary Database Storage
-- Ensures document files are persisted inside PostgreSQL (BYTEA) so that
-- any authorized user across all devices/environments can access the real file copy.
-- =====================================================================

ALTER TABLE document_vault ADD COLUMN IF NOT EXISTS file_data BYTEA;

-- Create index on owner and verification status for fast retrieval
CREATE INDEX IF NOT EXISTS idx_doc_vault_created_at ON document_vault(created_at DESC);
