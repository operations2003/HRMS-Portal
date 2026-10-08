import { employeeRepository } from '../repositories/employeeRepository.js';
import { orgRepository } from '../repositories/orgRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { roleRepository } from '../repositories/roleRepository.js';
import { designationRepository } from '../repositories/designationRepository.js';
import { leaveRepository } from '../repositories/leaveRepository.js';
import { hashPassword } from '../utils/passwordUtils.js';
import { appsumoService } from './appsumoService.js';
import { pool } from '../config/db.js';

/**
 * Handle PostgreSQL specific error codes for Employee domain
 */
const handlePostgresError = (err, data = {}) => {
  if (err.code === '23503') {
    // Foreign key violation
    let message = 'Invalid relational reference provided.';
    if (err.constraint === 'employees_org_id_fkey') {
      message = `Organization with ID '${data.orgId}' does not exist.`;
    } else if (err.constraint === 'employees_dept_id_fkey') {
      message = `Department with ID '${data.deptId}' does not exist.`;
    } else if (err.constraint === 'employees_desig_id_fkey') {
      message = `Designation with ID '${data.desigId}' does not exist.`;
    } else if (err.constraint === 'employees_user_id_fkey') {
      message = `User account with ID '${data.userId}' does not exist.`;
    }
    const error = new Error(message);
    error.statusCode = 400;
    return error;
  }

  if (err.code === '23505') {
    // Unique constraint violation
    let message = 'A unique constraint violation occurred.';
    if (err.constraint === 'uk_org_employee_code') {
      message = `Employee code '${data.employeeCode}' already exists in this organization.`;
    } else if (err.constraint === 'uk_org_employee_email') {
      message = `An employee with email '${data.email}' already exists in this organization.`;
    } else if (err.constraint === 'employees_user_id_key') {
      message = 'The specified user account is already linked to another employee.';
    }
    const error = new Error(message);
    error.statusCode = 409;
    return error;
  }

  if (err.code === '22007') {
    const error = new Error('Invalid date format or date value is out of range.');
    error.statusCode = 400;
    return error;
  }

  if (err.code === '22001') {
    const error = new Error('One or more text fields exceed the maximum allowed character length.');
    error.statusCode = 400;
    return error;
  }

  if (err.code === '22003') {
    const error = new Error('Numeric value is out of allowable range.');
    error.statusCode = 400;
    return error;
  }

  return err;
};

export const employeeService = {
  async listEmployees(query) {
    return await employeeRepository.findAll(query);
  },

  async getEmployeeById(id) {
    const employee = await employeeRepository.findById(id);
    if (!employee) {
      const error = new Error(`Employee with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }
    return employee;
  },

  async createEmployee(data) {
    // 1. Validate organization exists
    const org = await orgRepository.findById(data.orgId);
    if (!org) {
      const error = new Error(`Organization with ID '${data.orgId}' does not exist.`);
      error.statusCode = 400;
      throw error;
    }

    // 1b. Enforce AppSumo Tier Quota if organization has an AppSumo entitlement
    const entitlement = await appsumoService.getOrganizationEntitlement(data.orgId);
    if (entitlement && entitlement.hasAppSumo) {
      if (!entitlement.isEntitled) {
        const error = new Error(
          `Cannot add employee: Your organization's AppSumo license is currently ${entitlement.status}. Please reactivate your license to continue.`
        );
        error.statusCode = 403;
        throw error;
      }

      if (entitlement.maxEmployees && entitlement.maxEmployees < Infinity) {
        const currentEmployees = await employeeRepository.findAll({ orgId: data.orgId });
        const currentCount = currentEmployees.pagination?.total ?? (currentEmployees.employees?.length || 0);
        if (currentCount >= entitlement.maxEmployees) {
          const error = new Error(
            `Employee limit reached (${currentCount}/${entitlement.maxEmployees}) for your AppSumo tier (${entitlement.planName}). Please upgrade your tier in AppSumo to add more employees.`
          );
          error.statusCode = 403;
          throw error;
        }
      }
    }

    // 2. Pre-check duplicate email
    const existingEmail = await employeeRepository.findByEmail(data.email, data.orgId);
    if (existingEmail) {
      const error = new Error(`An employee with email '${data.email}' already exists.`);
      error.statusCode = 409;
      throw error;
    }

    // 3. Pre-check duplicate employeeCode if provided
    if (data.employeeCode) {
      const existingCode = await employeeRepository.findByCode(data.employeeCode, data.orgId);
      if (existingCode) {
        const error = new Error(`Employee code '${data.employeeCode}' already exists.`);
        error.statusCode = 409;
        throw error;
      }
    }

    // 4. Handle portal user account and password credentials if provided
    let userId = data.userId || null;
    if (data.password) {
      // Resolve role
      let role = null;
      if (data.roleId) {
        role = (await roleRepository.findRoleById(data.roleId)) || (await roleRepository.findRoleByName(data.roleId));
      }
      if (!role) {
        role = (await roleRepository.findRoleByName('Employee')) || (await roleRepository.findRoleByName('EMPLOYEE'));
      }
      if (!role) {
        const allRoles = await roleRepository.findAllRoles();
        role = allRoles.find((r) => r.name.toLowerCase() === 'employee') || allRoles[0];
      }

      const passwordHash = await hashPassword(data.password);

      // Check if user account with this email already exists
      const existingUser = await userRepository.findByEmail(data.email);
      if (existingUser) {
        // Check if already linked to another employee
        const empCheck = await pool.query(
          'SELECT id, first_name, last_name FROM employees WHERE user_id = $1 LIMIT 1;',
          [existingUser.id]
        );
        if (empCheck.rows.length > 0) {
          const linkedEmp = empCheck.rows[0];
          const error = new Error(
            `A user account with email '${data.email}' is already linked to employee '${linkedEmp.first_name} ${linkedEmp.last_name}'.`
          );
          error.statusCode = 409;
          throw error;
        }

        // Update user account credentials & active status
        await userRepository.update(existingUser.id, {
          passwordHash,
          status: data.status || 'Active',
          roleId: role ? role.id : existingUser.roleId,
          firstName: data.firstName,
          lastName: data.lastName,
          orgId: data.orgId,
        });
        userId = existingUser.id;
      } else {
        // Create new user login account
        const newUser = await userRepository.create({
          orgId: data.orgId,
          roleId: role ? role.id : 'role-employee',
          email: data.email,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          status: data.status || 'Active',
        });
        userId = newUser.id;
      }
    }

    // Enforce: Admin role has department 'Main' and is designated as CEO
    let assignedRole = null;
    if (data.roleId) {
      assignedRole = (await roleRepository.findRoleById(data.roleId)) || (await roleRepository.findRoleByName(data.roleId));
    }
    const isAdminRole =
      (assignedRole && (assignedRole.name.toLowerCase() === 'admin' || assignedRole.name.toLowerCase() === 'superadmin')) ||
      data.email === 'sheetalbedi@tasknera.com';
    if (isAdminRole) {
      const mainDeptRes = await pool.query(
        "SELECT id FROM departments WHERE (LOWER(name) = 'main' OR code = 'MAIN') AND org_id = $1 LIMIT 1;",
        [data.orgId || 'org-1']
      );
      data.deptId = mainDeptRes.rows[0]?.id || 'dept-main';
      const ceoDesig =
        (await designationRepository.findByCode('CEO', data.orgId)) ||
        (await designationRepository.findById('desig-ceo', data.orgId));
      if (ceoDesig) data.desigId = ceoDesig.id;
    }

    try {
      const newEmployee = await employeeRepository.create({
        ...data,
        userId,
      });

      // Initialize or set custom leave balances decided by Admin
      if (data.leaveAllocations) {
        await leaveRepository.setEmployeeLeaveAllocations(
          newEmployee.id,
          newEmployee.orgId,
          new Date().getFullYear(),
          data.leaveAllocations
        );
      } else {
        await leaveRepository.initializeBalancesForEmployee(
          newEmployee.id,
          newEmployee.orgId,
          new Date().getFullYear(),
          newEmployee.gender
        );
      }

      return newEmployee;
    } catch (err) {
      throw handlePostgresError(err, data);
    }
  },

  async updateEmployee(id, data, currentUser = null) {
    const existing = await employeeRepository.findById(id);
    if (!existing) {
      const error = new Error(`Employee with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    // HR cannot update her own shift timing (Admin retains full permission)
    if (currentUser) {
      const normRole = (currentUser.roleName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const isHr = ['hr', 'hrmanager'].includes(normRole);
      const isAdmin = ['admin', 'superadmin', 'orgadmin'].includes(normRole);

      if (isHr && !isAdmin) {
        const isSelf =
          (currentUser.employeeId && (existing.id === currentUser.employeeId || id === currentUser.employeeId)) ||
          (currentUser.id && (existing.userId === currentUser.id || existing.id === currentUser.id || id === currentUser.id)) ||
          (currentUser.email && existing.email && currentUser.email.toLowerCase() === existing.email.toLowerCase());

        if (isSelf && data.shiftTiming !== undefined) {
          const existingShift = (existing.shiftTiming || '11:00 AM - 07:00 PM').trim();
          const newShift = (data.shiftTiming || '').trim();
          if (newShift && newShift !== existingShift) {
            const error = new Error('Access denied: HR is not authorized to modify her own shift timing. Please contact an Administrator.');
            error.statusCode = 403;
            throw error;
          }
          delete data.shiftTiming;
        }
      }
    }

    const orgId = data.orgId || existing.orgId;

    if (data.email && data.email.toLowerCase() !== existing.email.toLowerCase()) {
      const emailTaken = await employeeRepository.findByEmail(data.email, orgId);
      if (emailTaken && emailTaken.id !== id) {
        const error = new Error(`Email '${data.email}' is already in use by another employee.`);
        error.statusCode = 409;
        throw error;
      }
    }

    if (data.employeeCode && data.employeeCode.toUpperCase() !== existing.employeeCode.toUpperCase()) {
      const codeTaken = await employeeRepository.findByCode(data.employeeCode, orgId);
      if (codeTaken && codeTaken.id !== id) {
        const error = new Error(`Employee code '${data.employeeCode}' is already in use.`);
        error.statusCode = 409;
        throw error;
      }
    }

    // Handle password update and linked user synchronization
    let userId = existing.userId;
    if (data.password) {
      const passwordHash = await hashPassword(data.password);
      let user = null;
      if (userId) {
        user = await userRepository.findById(userId);
      }
      if (!user) {
        user = await userRepository.findByEmail(data.email || existing.email);
      }

      if (user) {
        await userRepository.update(user.id, {
          passwordHash,
          email: data.email || user.email,
          firstName: data.firstName || user.firstName,
          lastName: data.lastName || user.lastName,
          status: data.status || user.status,
          ...(data.roleId ? { roleId: data.roleId } : {}),
        });
        userId = user.id;
      } else {
        let role = null;
        if (data.roleId) {
          role = (await roleRepository.findRoleById(data.roleId)) || (await roleRepository.findRoleByName(data.roleId));
        }
        if (!role) {
          role = (await roleRepository.findRoleByName('Employee')) || (await roleRepository.findRoleByName('EMPLOYEE'));
        }
        const newUser = await userRepository.create({
          orgId,
          roleId: role ? role.id : 'role-employee',
          email: data.email || existing.email,
          passwordHash,
          firstName: data.firstName || existing.firstName,
          lastName: data.lastName || existing.lastName,
          status: data.status || existing.status || 'Active',
        });
        userId = newUser.id;
      }
    } else if (userId && (data.email || data.firstName || data.lastName || data.status || data.roleId)) {
      // Sync basic profile updates to user account if linked
      await userRepository.update(userId, {
        ...(data.email ? { email: data.email } : {}),
        ...(data.firstName ? { firstName: data.firstName } : {}),
        ...(data.lastName ? { lastName: data.lastName } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.roleId ? { roleId: data.roleId } : {}),
      });
    }

    // Enforce: Admin role has department 'Main' and is designated as CEO
    let checkRole = null;
    if (data.roleId) {
      checkRole = (await roleRepository.findRoleById(data.roleId)) || (await roleRepository.findRoleByName(data.roleId));
    } else if (existing.user?.roleId) {
      checkRole = await roleRepository.findRoleById(existing.user.roleId);
    }
    const isEmpAdmin =
      (checkRole && (checkRole.name.toLowerCase() === 'admin' || checkRole.name.toLowerCase() === 'superadmin')) ||
      (existing.user?.roleName || '').toLowerCase() === 'admin' ||
      existing.email === 'sheetalbedi@tasknera.com' ||
      data.email === 'sheetalbedi@tasknera.com';
    if (isEmpAdmin) {
      const mainDeptRes = await pool.query(
        "SELECT id FROM departments WHERE (LOWER(name) = 'main' OR code = 'MAIN') AND org_id = $1 LIMIT 1;",
        [orgId || 'org-1']
      );
      data.deptId = mainDeptRes.rows[0]?.id || 'dept-main';
      const ceoDesig =
        (await designationRepository.findByCode('CEO', orgId)) ||
        (await designationRepository.findById('desig-ceo', orgId));
      if (ceoDesig) data.desigId = ceoDesig.id;
    }

    try {
      const updated = await employeeRepository.update(id, {
        ...data,
        userId,
      });

      if (data.leaveAllocations) {
        await leaveRepository.setEmployeeLeaveAllocations(
          id,
          orgId,
          new Date().getFullYear(),
          data.leaveAllocations
        );
      }

      return updated;
    } catch (err) {
      throw handlePostgresError(err, { ...existing, ...data });
    }
  },

  async deleteEmployee(id) {
    const existing = await employeeRepository.findById(id);
    if (!existing) {
      const error = new Error(`Employee with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    // Clean up dependent leave balances
    await pool.query('DELETE FROM leave_balances WHERE employee_id = $1;', [id]);

    return await employeeRepository.delete(id);
  },

  async getMetadata() {
    return await employeeRepository.getMetadata();
  },

  /**
   * Deprovision and mark employee profile as Exited (with associated user deactivation)
   */
  async deactivateEmployee(id, reason = 'Employee marked as exited') {
    const existing = await employeeRepository.findById(id);
    if (!existing) {
      const error = new Error(`Employee with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    // Mark employee as Exited
    const updatedEmp = await employeeRepository.update(id, { status: 'Exited' });

    // Mark associated portal user account as Inactive
    if (existing.userId) {
      await userRepository.update(existing.userId, { status: 'Inactive' });
    }

    return updatedEmp;
  },

  /**
   * Officially end an intern's internship (HR / Admin action)
   * Validates intern record, enforces authorization, records end date,
   * updates status to 'Completed', and preserves all historical data.
   */
  async endInternship(id, currentUser, options = {}) {
    // 1. Authorization: Only authorized HR or Admin users
    const allRoles = (Array.isArray(currentUser?.roles) ? currentUser.roles : [currentUser?.roleName || currentUser?.role || ''])
      .filter(Boolean)
      .map((r) => String(r).toLowerCase().replace(/[^a-z0-9]/g, ''));
    const isHrOrAdmin =
      allRoles.some((r) => ['admin', 'superadmin', 'orgadmin', 'hr', 'hrmanager'].includes(r)) ||
      (currentUser?.email || '').toLowerCase() === 'sheetalbedi@tasknera.com';

    if (!isHrOrAdmin) {
      const error = new Error('Access denied: Only authorized HR or Admin users can end an internship.');
      error.statusCode = 403;
      throw error;
    }

    // 2. Fetch employee
    const employee = await employeeRepository.findById(id);
    if (!employee) {
      const error = new Error(`Employee with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    // 3. Organization boundary check
    const normRole = (currentUser?.roleName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (currentUser?.orgId && employee.orgId !== currentUser.orgId && !normRole.includes('superadmin')) {
      const error = new Error('Access denied: Employee not found in your organization.');
      error.statusCode = 404;
      throw error;
    }

    // 4. Validate that the employee is an intern
    const empType = String(employee.employmentType || '').trim().toLowerCase();
    const desigTitle = String(employee.designation?.title || '').trim().toLowerCase();
    const isIntern = empType === 'intern' || empType === 'internship' || desigTitle.includes('intern');
    if (!isIntern) {
      const error = new Error(`Employee '${employee.firstName} ${employee.lastName}' is not registered as an intern.`);
      error.statusCode = 400;
      throw error;
    }

    // 5. Prevent repeated ending if already completed/ended
    const intStatus = String(employee.internshipStatus || '').trim().toUpperCase();
    const empStatus = String(employee.status || '').trim().toLowerCase();
    if (intStatus === 'COMPLETED' || intStatus === 'ENDED' || empStatus === 'completed') {
      const error = new Error(`The internship for '${employee.firstName} ${employee.lastName}' has already been officially ended.`);
      error.statusCode = 400;
      throw error;
    }

    // 6. Record internship end date using standard YYYY-MM-DD
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const currentDateStr = `${y}-${m}-${d}`;
    const endDate = (options.endDate && typeof options.endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(options.endDate.trim()))
      ? options.endDate.trim()
      : currentDateStr;

    // 7. Update status and internship details while preserving all historical records
    const updatedEmp = await employeeRepository.update(id, {
      status: 'Completed',
      internshipStatus: 'COMPLETED',
      internshipEndDate: endDate,
    });

    // 8. Audit log for compliance and timeline tracking
    try {
      await pool.query(
        `INSERT INTO admin_audit_logs (id, org_id, user_id, action_type, target_entity, target_id, changes, ip_address, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, NOW());`,
        [
          `audit-int-${Date.now()}`,
          employee.orgId,
          currentUser?.id || null,
          'END_INTERNSHIP',
          'EMPLOYEE',
          employee.id,
          JSON.stringify({
            employeeCode: employee.employeeCode,
            fullName: `${employee.firstName} ${employee.lastName}`,
            previousStatus: employee.status,
            newStatus: 'Completed',
            internshipStatus: 'COMPLETED',
            internshipEndDate: endDate,
            endedBy: currentUser?.email || 'HR/Admin',
          }),
          'Internal HRMS',
        ]
      );
    } catch {
      // Non-blocking
    }

    return updatedEmp;
  },
};
