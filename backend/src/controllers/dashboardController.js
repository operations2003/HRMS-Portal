import { orgRepository } from '../repositories/orgRepository.js';
import { employeeRepository } from '../repositories/employeeRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { departments } from '../repositories/dataStore.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const dashboardController = {
  /**
   * GET /api/v1/dashboard/stats
   */
  async getStats(req, res, next) {
    try {
      const orgs = await orgRepository.findAll();
      const empData = await employeeRepository.findAll({ limit: 100 });
      const users = await userRepository.findAll();

      const activeEmployees = empData.employees.filter((e) => e.status === 'Active').length;
      const onLeaveEmployees = empData.employees.filter((e) => e.status === 'On Leave').length;

      // Group employees by department for dashboard breakdown
      const deptDistribution = departments.map((dept) => {
        const count = empData.employees.filter((e) => e.deptId === dept.id).length;
        return {
          id: dept.id,
          name: dept.name,
          count,
        };
      });

      const stats = {
        totalOrganizations: orgs.length,
        activeOrganizations: orgs.filter((o) => o.status === 'Active').length,
        totalEmployees: empData.pagination.total,
        activeEmployees,
        onLeaveEmployees,
        totalDepartments: departments.length,
        totalUsers: users.length,
        recentEmployees: empData.employees.slice(0, 5),
        departmentDistribution: deptDistribution,
      };

      return sendSuccess(res, 'Dashboard metrics loaded.', stats);
    } catch (error) {
      next(error);
    }
  },
};
