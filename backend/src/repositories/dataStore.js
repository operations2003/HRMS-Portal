import { hashPassword } from '../utils/passwordUtils.js';

/**
 * DataStore - In-Memory Relational Data Repository for Phase 1
 * Designed specifically with normalized relationships so Ajay can replace
 * this store with SQL/ORM database queries seamlessly.
 */

export const permissions = [
  // Dashboard
  { id: 'perm-1', name: 'View Dashboard', code: 'dashboard:read', module: 'dashboard', description: 'Access dashboard and analytics' },
  
  // Organizations
  { id: 'perm-2', name: 'View Organizations', code: 'org:read', module: 'organization', description: 'View organization listings and details' },
  { id: 'perm-3', name: 'Create Organization', code: 'org:write', module: 'organization', description: 'Create and update organizations' },
  { id: 'perm-4', name: 'Delete Organization', code: 'org:delete', module: 'organization', description: 'Deactivate or delete organizations' },
  
  // Employees
  { id: 'perm-5', name: 'View Employees', code: 'employee:read', module: 'employee', description: 'View employee directory and profiles' },
  { id: 'perm-6', name: 'Create/Edit Employee', code: 'employee:write', module: 'employee', description: 'Add or update employee details' },
  { id: 'perm-7', name: 'Delete Employee', code: 'employee:delete', module: 'employee', description: 'Deactivate or delete employees' },
  
  // Departments & Designations
  { id: 'perm-8', name: 'View Departments', code: 'dept:read', module: 'department', description: 'View departments and designations' },
  { id: 'perm-9', name: 'Manage Departments', code: 'dept:write', module: 'department', description: 'Create and edit departments' },
  
  // Users & RBAC
  { id: 'perm-10', name: 'View Users', code: 'user:read', module: 'user', description: 'View system user accounts' },
  { id: 'perm-11', name: 'Manage Users', code: 'user:write', module: 'user', description: 'Create and update user accounts and roles' },
];

export const roles = [
  {
    id: 'role-admin',
    name: 'Admin',
    description: 'System Administrator with full control across all organizations and user management',
    permissions: [
      'dashboard:read',
      'org:read', 'org:write', 'org:delete',
      'employee:read', 'employee:write', 'employee:delete',
      'dept:read', 'dept:write',
      'user:read', 'user:write',
    ],
  },
  {
    id: 'role-hr',
    name: 'HR',
    description: 'Human Resources with employee and department lifecycle management',
    permissions: [
      'dashboard:read',
      'org:read',
      'employee:read', 'employee:write',
      'dept:read', 'dept:write',
      'user:read',
    ],
  },
  {
    id: 'role-manager',
    name: 'Manager',
    description: 'Department Manager with team visibility and reporting',
    permissions: [
      'dashboard:read',
      'employee:read',
      'dept:read',
    ],
  },
  {
    id: 'role-employee',
    name: 'Employee',
    description: 'Standard employee with profile and directory access',
    permissions: [
      'dashboard:read',
      'employee:read',
    ],
  },
];

export const organizations = [
  {
    id: 'org-1',
    name: 'Tasknera Global HR Solutions',
    code: 'TASKNERA',
    email: 'contact@tasknera.com',
    phone: '+1 (555) 019-2834',
    website: 'https://tasknera.com',
    address: '100 Innovation Way, Suite 400, San Francisco, CA',
    status: 'Active',
    createdAt: '2026-01-10T08:00:00.000Z',
    updatedAt: '2026-01-10T08:00:00.000Z',
  },
];

export const departments = [
  { id: 'dept-ops', orgId: 'org-1', name: 'Operations', code: 'OPS', status: 'Active' },
  { id: 'dept-hr', orgId: 'org-1', name: 'HR', code: 'HR', status: 'Active' },
  { id: 'dept-ta', orgId: 'org-1', name: 'Talent Acquisition', code: 'TA', status: 'Active' },
  { id: 'dept-ld', orgId: 'org-1', name: 'Learning & Development', code: 'L&D', status: 'Active' },
  { id: 'dept-it', orgId: 'org-1', name: 'IT', code: 'IT', status: 'Active' },
  { id: 'dept-bd', orgId: 'org-1', name: 'Business Development', code: 'BD', status: 'Active' },
];

export const designations = [
  { id: 'desig-ops-tl', orgId: 'org-1', title: 'Operations Team Leader', code: 'OPS-TL', status: 'Active' },
  { id: 'desig-hr-exec', orgId: 'org-1', title: 'HR Executive', code: 'HR-EXEC', status: 'Active' },
  { id: 'desig-ops-exec', orgId: 'org-1', title: 'Operations Executive', code: 'OPS-EXEC', status: 'Active' },
  { id: 'desig-ta-int', orgId: 'org-1', title: 'Talent Acquisition Intern', code: 'TA-INT', status: 'Active' },
  { id: 'desig-ta-spec', orgId: 'org-1', title: 'Talent Acquisition Specialist', code: 'TA-SPEC', status: 'Active' },
  { id: 'desig-hr-int', orgId: 'org-1', title: 'HR Intern', code: 'HR-INT', status: 'Active' },
  { id: 'desig-it-exec', orgId: 'org-1', title: 'IT Executive', code: 'IT-EXEC', status: 'Active' },
  { id: 'desig-it-int', orgId: 'org-1', title: 'IT Intern', code: 'IT-INT', status: 'Active' },
  { id: 'desig-bdm-supp', orgId: 'org-1', title: 'BDM Support', code: 'BDM-SUPP', status: 'Active' },
  { id: 'desig-bdm-exec', orgId: 'org-1', title: 'BDM Executive', code: 'BDM-EXEC', status: 'Active' },
  { id: 'desig-ta-head', orgId: 'org-1', title: 'Talent Acquisition Head', code: 'TA-HEAD', status: 'Active' },
  { id: 'desig-ops-head', orgId: 'org-1', title: 'Operations Head', code: 'OPS-HEAD', status: 'Active' },
  { id: 'desig-acct-exec', orgId: 'org-1', title: 'Account Executive', code: 'ACCT-EXEC', status: 'Active' },
  { id: 'desig-ta-tl', orgId: 'org-1', title: 'Talent Acquisition Team Leader', code: 'TA-TL', status: 'Active' },
];

export let users = [
  {
    id: 'user-superadmin-shubham',
    orgId: 'org-1',
    roleId: 'role-admin',
    email: 'sheetalbedi@tasknera.com',
    passwordHash: '$2a$10$KLssDM/qWkD1HLyWnmmmwOzx/bUcGyCqTLDSwHneZ/M6hUWjrDcNW',
    firstName: 'Sheetal',
    lastName: 'Bedi',
    status: 'Active',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

export let employees = [
  {
    id: 'emp-shubham-admin',
    orgId: 'org-1',
    deptId: 'dept-it',
    desigId: 'desig-it-exec',
    userId: 'user-superadmin-shubham',
    employeeCode: 'EMP-001',
    firstName: 'Sheetal',
    lastName: 'Bedi',
    email: 'sheetalbedi@tasknera.com',
    phone: '+91 9999999999',
    dateOfJoining: '2026-01-01',
    employmentType: 'Full-Time',
    status: 'Active',
    salary: 150000,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

let isInitialized = false;

/**
 * Initialize default test user credentials with secure bcrypt hashes
 */
export const initDataStore = async () => {
  if (isInitialized) return;

  const passwords = {
    'admin@hrms.local': 'Admin@123',
    'orgadmin@techcorp.local': 'OrgAdmin@123',
    'hr@techcorp.local': 'Hr@123',
    'emp@techcorp.local': 'Emp@123',
  };

  for (const user of users) {
    const rawPass = passwords[user.email] || 'Password@123';
    user.passwordHash = await hashPassword(rawPass);
  }

  isInitialized = true;
  console.log('✅ In-Memory DataStore initialized with secure bcrypt credentials.');
};
