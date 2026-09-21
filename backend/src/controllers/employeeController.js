import { employeeService } from '../services/employeeService.js';
import { employeeLifecycleService } from '../services/employeeLifecycleService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { pool } from '../config/db.js';


export const employeeController = {
  /**
   * GET /api/v1/employees
   */
  async list(req, res, next) {
    try {
      const { search, deptId, status, page, limit } = req.query;
      const isSuperAdmin = (req.user?.roleName || '').toLowerCase().includes('admin') && !req.user?.orgId;
      const orgId = isSuperAdmin ? (req.query.orgId || null) : (req.user?.orgId || req.query.orgId);

      const result = await employeeService.listEmployees({
        search,
        orgId,
        deptId,
        status,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
      });

      return sendSuccess(res, 'Employees retrieved successfully.', result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/employees/metadata
   */
  async getMetadata(req, res, next) {
    try {
      const metadata = await employeeService.getMetadata();
      return sendSuccess(res, 'Employee form metadata retrieved.', metadata);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/employees/:id
   */
  async getById(req, res, next) {
    try {
      const employee = await employeeService.getEmployeeById(req.params.id);
      if (req.user?.orgId && employee.orgId !== req.user.orgId) {
        const isSuperAdmin = (req.user?.roleName || '').toLowerCase().includes('admin') && !req.user.orgId;
        if (!isSuperAdmin) {
          const error = new Error('Access denied: Employee not found in your organization.');
          error.statusCode = 404;
          throw error;
        }
      }
      return sendSuccess(res, 'Employee details retrieved.', employee);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/employees
   */
  async create(req, res, next) {
    try {
      const newEmployee = await employeeService.createEmployee(req.body);
      return sendSuccess(res, 'Employee created successfully.', newEmployee, 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/v1/employees/:id
   */
  async update(req, res, next) {
    try {
      const existing = await employeeService.getEmployeeById(req.params.id);
      if (req.user?.orgId && existing.orgId !== req.user.orgId) {
        const isSuperAdmin = (req.user?.roleName || '').toLowerCase().includes('admin') && !req.user.orgId;
        if (!isSuperAdmin) {
          const error = new Error('Access denied: Employee not found in your organization.');
          error.statusCode = 404;
          throw error;
        }
      }
      const updated = await employeeService.updateEmployee(req.params.id, req.body);
      return sendSuccess(res, 'Employee updated successfully.', updated);
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/v1/employees/:id
   */
  async delete(req, res, next) {
    try {
      const existing = await employeeService.getEmployeeById(req.params.id);
      if (req.user?.orgId && existing.orgId !== req.user.orgId) {
        const isSuperAdmin = (req.user?.roleName || '').toLowerCase().includes('admin') && !req.user.orgId;
        if (!isSuperAdmin) {
          const error = new Error('Access denied: Employee not found in your organization.');
          error.statusCode = 404;
          throw error;
        }
      }
      await employeeService.deleteEmployee(req.params.id);
      return sendSuccess(res, 'Employee deleted successfully.', null);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/employees/:id/timeline
   * Module 1: Comprehensive Employee Lifecycle Timeline
   */
  async getTimeline(req, res, next) {
    try {
      const { id } = req.params;
      const orgId = req.user?.orgId || 'org-1';
      const filters = {
        eventType: req.query.eventType,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      };

      const timeline = await employeeLifecycleService.getEmployeeTimeline(id, orgId, filters);
      return sendSuccess(res, 'Employee lifecycle timeline retrieved.', timeline);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/employees/me/profile
   * Profile for currently logged-in user
   */
  async getMyProfile(req, res, next) {
    try {
      const user = req.user;
      const empQuery = await pool.query(
        `SELECT e.*, d.name as department_name, des.title as designation_title,
                m.first_name as manager_first_name, m.last_name as manager_last_name
         FROM employees e
         LEFT JOIN departments d ON e.dept_id = d.id
         LEFT JOIN designations des ON e.desig_id = des.id
         LEFT JOIN employees m ON e.manager_id = m.id
         WHERE e.user_id = $1 OR e.email = $2
         LIMIT 1;`,
        [user.id, user.email]
      );
      if (empQuery.rows.length === 0) {
        return sendError(res, 'Employee profile not found.', 404);
      }
      const emp = empQuery.rows[0];
      const rawAcc = (emp.bank_account_number || '').trim();
      const maskedBank = rawAcc.length >= 4 ? '•••• •••• •••• ' + rawAcc.slice(-4) : '•••• •••• •••• 5678';

      const profile = {
        id: emp.id,
        employeeCode: emp.employee_code,
        firstName: emp.first_name,
        lastName: emp.last_name,
        fullName: `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
        email: emp.email,
        phone: emp.phone || '',
        dateOfJoining: emp.date_of_joining,
        employmentType: emp.employment_type,
        status: emp.status,
        department: emp.department_name || 'General',
        designation: emp.designation_title || 'Employee',
        manager: emp.manager_first_name ? `${emp.manager_first_name} ${emp.manager_last_name || ''}`.trim() : 'Executive Leadership',
        gender: emp.gender || 'Not Specified',
        fatherName: emp.father_name || '',
        motherName: emp.mother_name || '',
        emergencyContact: emp.emergency_contact || '',
        address: emp.address || '',
        bankName: emp.bank_name || '',
        bankAccountMasked: maskedBank,
        bankIfsc: emp.bank_ifsc || '',
        bankBranch: emp.bank_branch || '',
        uanNumber: emp.uan_number || '',
      };

      return sendSuccess(res, 'Profile retrieved successfully.', profile);
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/v1/employees/me/profile
   * Self-service personal profile update (sensitive payroll/bank/UAN cannot be directly updated)
   */
  async updateMyProfile(req, res, next) {
    try {
      const user = req.user;
      const { phone, emergencyContact, address, fatherName, motherName } = req.body;

      const updateRes = await pool.query(
        `UPDATE employees
         SET 
           phone = COALESCE($1, phone),
           emergency_contact = COALESCE($2, emergency_contact),
           address = COALESCE($3, address),
           father_name = COALESCE($4, father_name),
           mother_name = COALESCE($5, mother_name),
           updated_at = NOW()
         WHERE user_id = $6 OR email = $7
         RETURNING *;`,
        [phone, emergencyContact, address, fatherName, motherName, user.id, user.email]
      );

      if (updateRes.rows.length === 0) {
        return sendError(res, 'Employee record not found.', 404);
      }

      return sendSuccess(res, 'Personal details updated successfully.', updateRes.rows[0]);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/employees/:id/profile
   * IDOR protected employee profile retrieval
   */
  async getProfileById(req, res, next) {
    try {
      const { id } = req.params;
      const caller = req.user;
      const role = (caller?.roleName || '').toLowerCase();
      const isHrAdmin = ['admin', 'superadmin', 'hr', 'hrmanager', 'orgadmin'].some(r => role.includes(r));

      const empQuery = await pool.query(
        `SELECT e.*, d.name as department_name, des.title as designation_title,
                m.first_name as manager_first_name, m.last_name as manager_last_name
         FROM employees e
         LEFT JOIN departments d ON e.dept_id = d.id
         LEFT JOIN designations des ON e.desig_id = des.id
         LEFT JOIN employees m ON e.manager_id = m.id
         WHERE e.id = $1
         LIMIT 1;`,
        [id]
      );

      if (empQuery.rows.length === 0) {
        return sendError(res, 'Employee not found.', 404);
      }

      const emp = empQuery.rows[0];

      // IDOR Verification
      const isSelf = emp.user_id === caller.id || emp.email === caller.email;
      let isManager = false;
      if (!isSelf && !isHrAdmin) {
        const callerEmp = await pool.query(`SELECT id FROM employees WHERE user_id = $1 OR email = $2 LIMIT 1;`, [caller.id, caller.email]);
        if (callerEmp.rows[0] && emp.manager_id === callerEmp.rows[0].id) {
          isManager = true;
        }
      }

      if (!isSelf && !isHrAdmin && !isManager) {
        return sendError(res, 'Access denied: You are not authorized to view this employee profile.', 403);
      }

      const rawAcc = (emp.bank_account_number || '').trim();
      const maskedBank = rawAcc.length >= 4 ? '•••• •••• •••• ' + rawAcc.slice(-4) : '•••• •••• •••• 5678';

      const profile = {
        id: emp.id,
        employeeCode: emp.employee_code,
        firstName: emp.first_name,
        lastName: emp.last_name,
        fullName: `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
        email: emp.email,
        phone: emp.phone || '',
        dateOfJoining: emp.date_of_joining,
        employmentType: emp.employment_type,
        status: emp.status,
        department: emp.department_name || 'General',
        designation: emp.designation_title || 'Employee',
        manager: emp.manager_first_name ? `${emp.manager_first_name} ${emp.manager_last_name || ''}`.trim() : 'Executive Leadership',
        gender: emp.gender || 'Not Specified',
        fatherName: emp.father_name || '',
        motherName: emp.mother_name || '',
        emergencyContact: emp.emergency_contact || '',
        address: emp.address || '',
        bankName: emp.bank_name || '',
        bankAccountMasked: maskedBank,
        bankIfsc: emp.bank_ifsc || '',
        bankBranch: emp.bank_branch || '',
        uanNumber: emp.uan_number || '',
      };

      return sendSuccess(res, 'Profile retrieved successfully.', profile);
    } catch (error) {
      next(error);
    }
  },
};
