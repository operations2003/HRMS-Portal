import { employeeRepository } from '../repositories/employeeRepository.js';
import { orgRepository } from '../repositories/orgRepository.js';

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

    try {
      return await employeeRepository.create(data);
    } catch (err) {
      throw handlePostgresError(err, data);
    }
  },

  async updateEmployee(id, data) {
    const existing = await employeeRepository.findById(id);
    if (!existing) {
      const error = new Error(`Employee with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
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

    try {
      return await employeeRepository.update(id, data);
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

    return await employeeRepository.delete(id);
  },

  async getMetadata() {
    return await employeeRepository.getMetadata();
  },
};
