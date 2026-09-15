import { employeeRepository } from '../repositories/employeeRepository.js';
import { orgRepository } from '../repositories/orgRepository.js';

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
    // Validate organization exists
    const org = await orgRepository.findById(data.orgId);
    if (!org) {
      const error = new Error(`Organization with ID '${data.orgId}' does not exist.`);
      error.statusCode = 400;
      throw error;
    }

    // Check duplicate email
    const existingEmail = await employeeRepository.findByEmail(data.email);
    if (existingEmail) {
      const error = new Error(`An employee with email '${data.email}' already exists.`);
      error.statusCode = 409;
      throw error;
    }

    // Check duplicate employeeCode if provided
    if (data.employeeCode) {
      const existingCode = await employeeRepository.findByCode(data.employeeCode);
      if (existingCode) {
        const error = new Error(`Employee code '${data.employeeCode}' already exists.`);
        error.statusCode = 409;
        throw error;
      }
    }

    return await employeeRepository.create(data);
  },

  async updateEmployee(id, data) {
    const existing = await employeeRepository.findById(id);
    if (!existing) {
      const error = new Error(`Employee with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    if (data.email && data.email.toLowerCase() !== existing.email.toLowerCase()) {
      const emailTaken = await employeeRepository.findByEmail(data.email);
      if (emailTaken && emailTaken.id !== id) {
        const error = new Error(`Email '${data.email}' is already in use by another employee.`);
        error.statusCode = 409;
        throw error;
      }
    }

    return await employeeRepository.update(id, data);
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
