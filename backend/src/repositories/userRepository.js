import { users, organizations } from './dataStore.js';
import { roleRepository } from './roleRepository.js';

export const userRepository = {
  async findByEmail(email) {
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) return null;

    const role = await roleRepository.findRoleById(user.roleId);
    const org = organizations.find((o) => o.id === user.orgId);

    return {
      ...user,
      roleName: role ? role.name : 'Unknown',
      roleDescription: role ? role.description : '',
      permissions: role ? role.permissions : [],
      organization: org ? { id: org.id, name: org.name, code: org.code } : null,
    };
  },

  async findById(id) {
    const user = users.find((u) => u.id === id);
    if (!user) return null;

    const role = await roleRepository.findRoleById(user.roleId);
    const org = organizations.find((o) => o.id === user.orgId);

    return {
      ...user,
      roleName: role ? role.name : 'Unknown',
      roleDescription: role ? role.description : '',
      permissions: role ? role.permissions : [],
      organization: org ? { id: org.id, name: org.name, code: org.code } : null,
    };
  },

  async findAll() {
    return Promise.all(
      users.map(async (u) => {
        const role = await roleRepository.findRoleById(u.roleId);
        const org = organizations.find((o) => o.id === u.orgId);
        return {
          id: u.id,
          orgId: u.orgId,
          roleId: u.roleId,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          status: u.status,
          createdAt: u.createdAt,
          roleName: role ? role.name : 'Unknown',
          permissions: role ? role.permissions : [],
          organization: org ? { id: org.id, name: org.name, code: org.code } : null,
        };
      })
    );
  },

  async create(data) {
    const newUser = {
      id: `user-${Date.now()}`,
      orgId: data.orgId || 'org-1',
      roleId: data.roleId || 'role-employee',
      email: data.email.trim().toLowerCase(),
      passwordHash: data.passwordHash,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      status: data.status || 'Active',
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    return this.findById(newUser.id);
  },

  async update(id, data) {
    const index = users.findIndex((u) => u.id === id);
    if (index === -1) return null;

    const existing = users[index];
    const updated = {
      ...existing,
      ...data,
      id: existing.id,
    };

    users[index] = updated;
    return this.findById(id);
  },
};
