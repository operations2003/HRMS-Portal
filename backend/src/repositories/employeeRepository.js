import { employees, organizations, departments, designations } from './dataStore.js';

export const employeeRepository = {
  async findAll({ search = '', orgId = '', deptId = '', status = '', page = 1, limit = 20 } = {}) {
    let result = [...employees];

    if (orgId) {
      result = result.filter((e) => e.orgId === orgId);
    }

    if (deptId) {
      result = result.filter((e) => e.deptId === deptId);
    }

    if (status) {
      result = result.filter((e) => e.status.toLowerCase() === status.toLowerCase());
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.firstName.toLowerCase().includes(q) ||
          e.lastName.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q) ||
          e.employeeCode.toLowerCase().includes(q)
      );
    }

    const total = result.length;
    const startIndex = (page - 1) * limit;
    const paginated = result.slice(startIndex, startIndex + limit);

    // Enrich with relation objects
    const enriched = paginated.map((emp) => {
      const org = organizations.find((o) => o.id === emp.orgId);
      const dept = departments.find((d) => d.id === emp.deptId);
      const desig = designations.find((ds) => ds.id === emp.desigId);

      return {
        ...emp,
        organization: org ? { id: org.id, name: org.name, code: org.code } : null,
        department: dept ? { id: dept.id, name: dept.name, code: dept.code } : null,
        designation: desig ? { id: desig.id, title: desig.title, code: desig.code } : null,
      };
    });

    return {
      employees: enriched,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  },

  async findById(id) {
    const emp = employees.find((e) => e.id === id);
    if (!emp) return null;

    const org = organizations.find((o) => o.id === emp.orgId);
    const dept = departments.find((d) => d.id === emp.deptId);
    const desig = designations.find((ds) => ds.id === emp.desigId);

    return {
      ...emp,
      organization: org ? { id: org.id, name: org.name, code: org.code } : null,
      department: dept ? { id: dept.id, name: dept.name, code: dept.code } : null,
      designation: desig ? { id: desig.id, title: desig.title, code: desig.code } : null,
    };
  },

  async findByCode(code) {
    return employees.find((e) => e.employeeCode.toUpperCase() === code.toUpperCase()) || null;
  },

  async findByEmail(email) {
    return employees.find((e) => e.email.toLowerCase() === email.toLowerCase()) || null;
  },

  async create(data) {
    const newEmployee = {
      id: `emp-${Date.now()}`,
      orgId: data.orgId,
      deptId: data.deptId || null,
      desigId: data.desigId || null,
      userId: data.userId || null,
      employeeCode: data.employeeCode || `EMP-${Math.floor(100 + Math.random() * 900)}`,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone || '',
      dateOfJoining: data.dateOfJoining || new Date().toISOString().split('T')[0],
      employmentType: data.employmentType || 'Full-Time',
      status: data.status || 'Active',
      salary: data.salary ? Number(data.salary) : 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    employees.unshift(newEmployee);
    return this.findById(newEmployee.id);
  },

  async update(id, data) {
    const index = employees.findIndex((e) => e.id === id);
    if (index === -1) return null;

    const existing = employees[index];
    const updated = {
      ...existing,
      ...data,
      id: existing.id,
      updatedAt: new Date().toISOString(),
    };

    employees[index] = updated;
    return this.findById(id);
  },

  async delete(id) {
    const index = employees.findIndex((e) => e.id === id);
    if (index === -1) return false;

    employees.splice(index, 1);
    return true;
  },

  async getMetadata() {
    return {
      organizations: organizations.map((o) => ({ id: o.id, name: o.name, code: o.code })),
      departments: departments.map((d) => ({ id: d.id, orgId: d.orgId, name: d.name, code: d.code })),
      designations: designations.map((ds) => ({ id: ds.id, orgId: ds.orgId, title: ds.title, code: ds.code })),
    };
  },
};
