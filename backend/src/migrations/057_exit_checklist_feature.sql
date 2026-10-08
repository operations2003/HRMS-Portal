-- =====================================================================
-- Migration 057: Exit Checklist Feature Foundation
-- Database: PostgreSQL 17+
-- =====================================================================

-- 1. Create Exit Checklists Table
CREATE TABLE IF NOT EXISTS exit_checklists (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    resignation_date DATE NOT NULL,
    last_working_day DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'In Progress' CHECK (status IN ('In Progress', 'Completed', 'Cancelled')),
    created_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ DEFAULT NULL,
    completed_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create Exit Checklist Items Table
CREATE TABLE IF NOT EXISTS exit_checklist_items (
    id VARCHAR(64) PRIMARY KEY,
    checklist_id VARCHAR(64) NOT NULL REFERENCES exit_checklists(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Completed')),
    completed_at TIMESTAMPTZ DEFAULT NULL,
    completed_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT DEFAULT '',
    order_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Triggers for updated_at
DROP TRIGGER IF EXISTS trg_exit_checklists_updated_at ON exit_checklists;
CREATE TRIGGER trg_exit_checklists_updated_at
BEFORE UPDATE ON exit_checklists
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_exit_checklist_items_updated_at ON exit_checklist_items;
CREATE TRIGGER trg_exit_checklist_items_updated_at
BEFORE UPDATE ON exit_checklist_items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 4. Indexes for query and relationship performance
CREATE INDEX IF NOT EXISTS idx_exit_checklists_org ON exit_checklists(org_id);
CREATE INDEX IF NOT EXISTS idx_exit_checklists_emp ON exit_checklists(employee_id);
CREATE INDEX IF NOT EXISTS idx_exit_checklists_status ON exit_checklists(status);
CREATE INDEX IF NOT EXISTS idx_exit_checklists_created ON exit_checklists(created_at);

CREATE INDEX IF NOT EXISTS idx_exit_checklist_items_chk ON exit_checklist_items(checklist_id);
CREATE INDEX IF NOT EXISTS idx_exit_checklist_items_status ON exit_checklist_items(status);
CREATE INDEX IF NOT EXISTS idx_exit_checklist_items_order ON exit_checklist_items(order_index);

-- 5. Partial Unique Index: Only one In Progress exit checklist per employee at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_exit_checklist_per_emp
ON exit_checklists (employee_id)
WHERE status = 'In Progress';
