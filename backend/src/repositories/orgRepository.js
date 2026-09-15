import { organizations, departments, employees } from './dataStore.js';

export const orgRepository = {
  async findAll({ search = '', status = '' } = {}) {
    let result = [...organizations];

    if (status) {
      result = result.filter((org) => org.status.toLowerCase() === status.toLowerCase());
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (org) =>
          org.name.toLowerCase().includes(q) ||
          org.code.toLowerCase().includes(q) ||
          org.email.toLowerCase().includes(q)
      );
    }

    return result.map((org) => {
      const deptCount = departments.filter((d) => d.orgId === org.id).length;
      const empCount = employees.filter((e) => e.orgId === org.id).length;
      return {
        ...org,
        stats: {
          departmentsCount: deptCount,
          employeesCount: empCount,
        },
      };
    });
  },

  async findById(id) {
    const org = organizations.find((o) => o.id === id);
    if (!org) return null;

    const orgDepts = departments.filter((d) => d.orgId === id);
    const orgEmployees = employees.filter((e) => e.orgId === id);

    return {
      ...org,
      departments: orgDepts,
      stats: {
        departmentsCount: orgDepts.length,
        employeesCount: orgEmployees.length,
      },
    };
  },

  async findByCode(code) {
    return organizations.find((o) => o.code.toUpperCase() === code.toUpperCase()) || null;
  },

  async create(data) {
    const newOrg = {
      id: `org-${Date.now()}`,
      name: data.name.trim(),
      code: data.code.trim().toUpperCase(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone || '',
      website: data.website || '',
      address: data.address || '',
      status: data.status || 'Active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      stats: {
        departmentsCount: 0,
        employeesCount: 0,
      },
    };

    organizations.unshift(newOrg);
    return newOrg;
  },

  async update(id, data) {
    const index = organizations.findIndex((o) => o.id === id);
    if (index === -1) return null;

    const existing = organizations[index];
    const updatedOrg = {
      ...existing,
      ...data,
      id: existing.id, // Immutable
      updatedAt: new Date().toISOString(),
    };

    organizations[index] = updatedOrg;
    return updatedOrg;
  },

  async delete(id) {
    const index = organizations.findIndex((o) => o.id === id);
    if (index === -1) return false;

    // Soft delete / status change or hard delete
    organizations.splice(index, 1);
    return true;
  },
};
