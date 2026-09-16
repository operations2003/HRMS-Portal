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
  { id: 'dept-1', orgId: 'org-1', name: 'Engineering & Technology', code: 'ENG', status: 'Active' },
  { id: 'dept-2', orgId: 'org-1', name: 'Human Resources', code: 'HR', status: 'Active' },
  { id: 'dept-3', orgId: 'org-1', name: 'Sales & Marketing', code: 'SALES', status: 'Active' },
  { id: 'dept-4', orgId: 'org-1', name: 'Finance & Accounts', code: 'FIN', status: 'Active' },
  { id: 'dept-5', orgId: 'org-2', name: 'Fleet Operations', code: 'OPS', status: 'Active' },
];

export const designations = [
  { id: 'desig-1', orgId: 'org-1', title: 'Principal Software Architect', code: 'ARCH' },
  { id: 'desig-2', orgId: 'org-1', title: 'Senior Full Stack Engineer', code: 'SDE-2' },
  { id: 'desig-3', orgId: 'org-1', title: 'HR Operations Lead', code: 'HR-LEAD' },
  { id: 'desig-4', orgId: 'org-1', title: 'Enterprise Account Executive', code: 'SALES-EXEC' },
  { id: 'desig-5', orgId: 'org-2', title: 'Logistics Coordinator', code: 'LOG-COORD' },
];

export let users = [
  {
    id: 'user-superadmin-shubham',
    orgId: 'org-1',
    roleId: 'role-admin',
    email: 'shubham@tasknera.com',
    passwordHash: '$2a$10$KLssDM/qWkD1HLyWnmmmwOzx/bUcGyCqTLDSwHneZ/M6hUWjrDcNW', // Shubham@264
    firstName: 'Shubham',
    lastName: 'Admin',
    status: 'Active',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

export let employees = [
  {
    id: 'emp-shubham-admin',
    orgId: 'org-1',
    deptId: 'dept-1',
    desigId: 'desig-1',
    userId: 'user-superadmin-shubham',
    employeeCode: 'EMP-001',
    firstName: 'Shubham',
    lastName: 'Admin',
    email: 'shubham@tasknera.com',
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
