-- Migration 027: Complete HRMS v2.1 Modules
-- Target: Implement Probation, Learning & Development, Engagement, Tasks, Expenses, Analytics, Master Data

-- ================================================================
-- 1. EMPLOYEE EXTENSION: PROBATION FIELDS
-- ================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'probation_status') THEN
        ALTER TABLE employees ADD COLUMN probation_status VARCHAR(30) DEFAULT 'CONFIRMED' CHECK (probation_status IN ('IN_PROBATION', 'CONFIRMED', 'EXTENDED', 'REJECTED'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'probation_start_date') THEN
        ALTER TABLE employees ADD COLUMN probation_start_date DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'probation_end_date') THEN
        ALTER TABLE employees ADD COLUMN probation_end_date DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'probation_notes') THEN
        ALTER TABLE employees ADD COLUMN probation_notes TEXT;
    END IF;
END $$;

-- Populate default probation dates for existing active employees if null
UPDATE employees 
SET probation_start_date = date_of_joining,
    probation_end_date = date_of_joining + INTERVAL '3 months'
WHERE probation_start_date IS NULL;

-- ================================================================
-- 2. PROBATION EVALUATIONS TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS probation_evaluations (
    id VARCHAR(50) PRIMARY KEY,
    org_id VARCHAR(50) NOT NULL REFERENCES organizations(id),
    employee_id VARCHAR(50) NOT NULL REFERENCES employees(id),
    manager_id VARCHAR(50) REFERENCES employees(id),
    review_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'MANAGER_EVALUATED', 'CONFIRMED', 'EXTENDED', 'REJECTED')),
    manager_rating INT CHECK (manager_rating BETWEEN 1 AND 5),
    manager_recommendation VARCHAR(30) CHECK (manager_recommendation IN ('CONFIRM', 'EXTEND', 'REJECT')),
    manager_comments TEXT,
    extension_months INT DEFAULT 0,
    extended_until DATE,
    hr_comments TEXT,
    reviewed_by_hr_id VARCHAR(50) REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_probation_org ON probation_evaluations(org_id);
CREATE INDEX IF NOT EXISTS idx_probation_employee ON probation_evaluations(employee_id);
CREATE INDEX IF NOT EXISTS idx_probation_status ON probation_evaluations(status);

-- ================================================================
-- 3. LEARNING & DEVELOPMENT (COURSES, ENROLLMENTS, SKILLS)
-- ================================================================
CREATE TABLE IF NOT EXISTS courses (
    id VARCHAR(50) PRIMARY KEY,
    org_id VARCHAR(50) NOT NULL REFERENCES organizations(id),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL DEFAULT 'TECHNICAL' CHECK (category IN ('TECHNICAL', 'COMPLIANCE', 'LEADERSHIP', 'ONBOARDING', 'SOFT_SKILLS', 'GENERAL')),
    duration_hours NUMERIC(5,1) DEFAULT 1.0,
    is_mandatory BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_courses_org ON courses(org_id);
CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category);

CREATE TABLE IF NOT EXISTS course_enrollments (
    id VARCHAR(50) PRIMARY KEY,
    org_id VARCHAR(50) NOT NULL REFERENCES organizations(id),
    course_id VARCHAR(50) NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    employee_id VARCHAR(50) NOT NULL REFERENCES employees(id),
    assigned_by VARCHAR(50),
    enrollment_type VARCHAR(30) DEFAULT 'MANDATORY' CHECK (enrollment_type IN ('MANDATORY', 'OPTIONAL', 'NOMINATED')),
    status VARCHAR(30) DEFAULT 'ENROLLED' CHECK (status IN ('ENROLLED', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED')),
    progress_percentage INT DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
    completion_date DATE,
    certificate_url TEXT,
    certificate_expiry DATE,
    feedback_rating INT CHECK (feedback_rating BETWEEN 1 AND 5),
    feedback_comments TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_course_enrollment UNIQUE (course_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_course_enrollments_org ON course_enrollments(org_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_emp ON course_enrollments(employee_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_status ON course_enrollments(status);

CREATE TABLE IF NOT EXISTS employee_skills (
    id VARCHAR(50) PRIMARY KEY,
    org_id VARCHAR(50) NOT NULL REFERENCES organizations(id),
    employee_id VARCHAR(50) NOT NULL REFERENCES employees(id),
    skill_name VARCHAR(100) NOT NULL,
    proficiency_level VARCHAR(30) DEFAULT 'INTERMEDIATE' CHECK (proficiency_level IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT')),
    verified_by VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_emp_skill UNIQUE (employee_id, skill_name)
);

CREATE INDEX IF NOT EXISTS idx_emp_skills_emp ON employee_skills(employee_id);

-- ================================================================
-- 4. EMPLOYEE ENGAGEMENT (ANNOUNCEMENTS, SURVEYS, RECOGNITIONS)
-- ================================================================
CREATE TABLE IF NOT EXISTS announcements (
    id VARCHAR(50) PRIMARY KEY,
    org_id VARCHAR(50) NOT NULL REFERENCES organizations(id),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'GENERAL' CHECK (category IN ('GENERAL', 'POLICY', 'EVENT', 'URGENT')),
    target_type VARCHAR(30) DEFAULT 'ALL' CHECK (target_type IN ('ALL', 'DEPARTMENT', 'TEAM', 'EMPLOYEE')),
    target_dept_id VARCHAR(50) REFERENCES departments(id),
    target_employee_ids JSONB DEFAULT '[]',
    publish_date TIMESTAMPTZ DEFAULT NOW(),
    expiry_date TIMESTAMPTZ,
    is_pinned BOOLEAN DEFAULT false,
    author_id VARCHAR(50) NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_org ON announcements(org_id);
CREATE INDEX IF NOT EXISTS idx_announcements_pinned ON announcements(is_pinned);

CREATE TABLE IF NOT EXISTS announcement_read_receipts (
    id VARCHAR(50) PRIMARY KEY,
    announcement_id VARCHAR(50) NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id),
    read_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uk_announcement_user_read UNIQUE (announcement_id, user_id)
);

CREATE TABLE IF NOT EXISTS engagement_surveys (
    id VARCHAR(50) PRIMARY KEY,
    org_id VARCHAR(50) NOT NULL REFERENCES organizations(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    questions JSONB NOT NULL DEFAULT '[]',
    target_type VARCHAR(30) DEFAULT 'ALL',
    target_dept_id VARCHAR(50) REFERENCES departments(id),
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    is_anonymous BOOLEAN DEFAULT true,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'ACTIVE', 'CLOSED')),
    created_by VARCHAR(50) REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS survey_responses (
    id VARCHAR(50) PRIMARY KEY,
    survey_id VARCHAR(50) NOT NULL REFERENCES engagement_surveys(id) ON DELETE CASCADE,
    respondent_id VARCHAR(50) REFERENCES users(id),
    answers JSONB NOT NULL DEFAULT '{}',
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uk_survey_respondent UNIQUE (survey_id, respondent_id)
);

CREATE TABLE IF NOT EXISTS employee_recognitions (
    id VARCHAR(50) PRIMARY KEY,
    org_id VARCHAR(50) NOT NULL REFERENCES organizations(id),
    sender_id VARCHAR(50) NOT NULL REFERENCES employees(id),
    recipient_id VARCHAR(50) NOT NULL REFERENCES employees(id),
    badge_type VARCHAR(50) NOT NULL DEFAULT 'KUDOS',
    message TEXT NOT NULL,
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recognitions_recipient ON employee_recognitions(recipient_id);

-- ================================================================
-- 5. INTERNAL TASK & WORK MANAGEMENT
-- ================================================================
CREATE TABLE IF NOT EXISTS work_tasks (
    id VARCHAR(50) PRIMARY KEY,
    org_id VARCHAR(50) NOT NULL REFERENCES organizations(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    creator_id VARCHAR(50) NOT NULL REFERENCES employees(id),
    assignee_id VARCHAR(50) NOT NULL REFERENCES employees(id),
    dept_id VARCHAR(50) REFERENCES departments(id),
    priority VARCHAR(20) DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    status VARCHAR(30) DEFAULT 'TODO' CHECK (status IN ('TODO', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED')),
    due_date DATE,
    subtasks JSONB DEFAULT '[]',
    comments JSONB DEFAULT '[]',
    attachments JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_tasks_org ON work_tasks(org_id);
CREATE INDEX IF NOT EXISTS idx_work_tasks_assignee ON work_tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_work_tasks_status ON work_tasks(status);

-- ================================================================
-- 6. STANDALONE EXPENSE & REIMBURSEMENT (NON-PAYROLL)
-- ================================================================
CREATE TABLE IF NOT EXISTS expense_claims (
    id VARCHAR(50) PRIMARY KEY,
    org_id VARCHAR(50) NOT NULL REFERENCES organizations(id),
    claim_number VARCHAR(50) NOT NULL UNIQUE,
    employee_id VARCHAR(50) NOT NULL REFERENCES employees(id),
    category VARCHAR(50) NOT NULL CHECK (category IN ('TRAVEL', 'MEALS', 'TRAINING', 'OFFICE_SUPPLIES', 'CLIENT_ENTERTAINMENT', 'OTHER')),
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(10) DEFAULT 'INR',
    expense_date DATE NOT NULL,
    description TEXT NOT NULL,
    receipt_url TEXT,
    status VARCHAR(30) DEFAULT 'SUBMITTED' CHECK (status IN ('DRAFT', 'SUBMITTED', 'MANAGER_REVIEW', 'APPROVED', 'REJECTED', 'REWORK_REQUIRED', 'REIMBURSEMENT_PENDING', 'REIMBURSED', 'CANCELLED')),
    manager_id VARCHAR(50) REFERENCES employees(id),
    manager_approval_date TIMESTAMPTZ,
    manager_comments TEXT,
    hr_id VARCHAR(50) REFERENCES users(id),
    hr_approval_date TIMESTAMPTZ,
    hr_comments TEXT,
    reimbursed_at TIMESTAMPTZ,
    payment_reference VARCHAR(100),
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expense_claims_org ON expense_claims(org_id);
CREATE INDEX IF NOT EXISTS idx_expense_claims_emp ON expense_claims(employee_id);
CREATE INDEX IF NOT EXISTS idx_expense_claims_status ON expense_claims(status);

-- ================================================================
-- 7. NEW PERMISSIONS & ROLE BINDINGS
-- ================================================================
INSERT INTO permissions (id, code, name, module, description, created_at, updated_at) VALUES
    ('perm-probation-read', 'probation:read', 'View Probation', 'probation', 'View employee probation status and evaluations', NOW(), NOW()),
    ('perm-probation-write', 'probation:write', 'Manage Probation', 'probation', 'Evaluate, confirm, extend, or reject employee probation', NOW(), NOW()),
    ('perm-training-read', 'training:read', 'View Training', 'training', 'View courses, skill matrices, and training enrollments', NOW(), NOW()),
    ('perm-training-write', 'training:write', 'Manage Training', 'training', 'Manage courses, assign trainings, and record completions', NOW(), NOW()),
    ('perm-engagement-read', 'engagement:read', 'View Engagement', 'engagement', 'View announcements, participate in surveys, view kudos', NOW(), NOW()),
    ('perm-engagement-write', 'engagement:write', 'Manage Engagement', 'engagement', 'Create announcements, launch surveys, post recognitions', NOW(), NOW()),
    ('perm-task-read', 'task:read', 'View Tasks', 'tasks', 'View assigned, team, or organization work tasks', NOW(), NOW()),
    ('perm-task-write', 'task:write', 'Manage Tasks', 'tasks', 'Create, assign, update, and manage work tasks', NOW(), NOW()),
    ('perm-expense-read', 'expense:read', 'View Expenses', 'expenses', 'View personal, team, or organization expense claims', NOW(), NOW()),
    ('perm-expense-write', 'expense:write', 'Manage Expenses', 'expenses', 'Submit, edit, or cancel personal expense claims', NOW(), NOW()),
    ('perm-expense-approve', 'expense:approve', 'Approve Expenses', 'expenses', 'Review, approve, reject, or mark reimbursed expense claims', NOW(), NOW()),
    ('perm-analytics-read', 'analytics:read', 'View Analytics', 'analytics', 'Access workforce analytics, trends, and intelligence reports', NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    module = EXCLUDED.module,
    updated_at = NOW();

-- Bind permissions to roles
-- Admin: all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('Admin', 'SuperAdmin', 'OrgAdmin')
  AND p.code IN (
    'probation:read', 'probation:write',
    'training:read', 'training:write',
    'engagement:read', 'engagement:write',
    'task:read', 'task:write',
    'expense:read', 'expense:write', 'expense:approve',
    'analytics:read'
  )
ON CONFLICT DO NOTHING;

-- HR: all except administrative super powers
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('HR', 'HRManager')
  AND p.code IN (
    'probation:read', 'probation:write',
    'training:read', 'training:write',
    'engagement:read', 'engagement:write',
    'task:read', 'task:write',
    'expense:read', 'expense:write', 'expense:approve',
    'analytics:read'
  )
ON CONFLICT DO NOTHING;

-- Manager: team scope
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Manager'
  AND p.code IN (
    'probation:read', 'probation:write',
    'training:read',
    'engagement:read', 'engagement:write',
    'task:read', 'task:write',
    'expense:read', 'expense:write', 'expense:approve',
    'analytics:read'
  )
ON CONFLICT DO NOTHING;

-- Employee: self-service
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Employee'
  AND p.code IN (
    'probation:read',
    'training:read',
    'engagement:read', 'engagement:write',
    'task:read', 'task:write',
    'expense:read', 'expense:write'
  )
ON CONFLICT DO NOTHING;
