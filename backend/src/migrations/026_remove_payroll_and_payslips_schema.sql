-- Migration 026: Safe Removal of Payroll & Payslip Database Artifacts
-- Target: Drop remaining Payroll & Payslip views, tables, and permissions while preserving shared dependencies.
-- Shared dependencies preserved: employees.salary, fnf_settlements, document_vault.

-- 1. Drop Views
DROP VIEW IF EXISTS v_payslip_items CASCADE;
DROP VIEW IF EXISTS v_employee_payslips CASCADE;

-- 2. Drop Tables in correct dependency order
DROP TABLE IF EXISTS payroll_items CASCADE;
DROP TABLE IF EXISTS payslips CASCADE;
DROP TABLE IF EXISTS payroll_records CASCADE;
DROP TABLE IF EXISTS payroll_periods CASCADE;
DROP TABLE IF EXISTS payroll_profiles CASCADE;

-- 3. Delete Payroll & Payslip Permissions and bindings
DELETE FROM role_permissions 
WHERE permission_id IN (
    'perm-payroll-read', 
    'perm-payroll-write', 
    'perm-payroll-process', 
    'perm-payslip-read'
);

DELETE FROM permissions 
WHERE id IN (
    'perm-payroll-read', 
    'perm-payroll-write', 
    'perm-payroll-process', 
    'perm-payslip-read'
) OR module = 'payroll';

