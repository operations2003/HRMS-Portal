import { employeeService } from '../services/employeeService.js';
import { sendSuccess } from '../utils/apiResponse.js';

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
};
