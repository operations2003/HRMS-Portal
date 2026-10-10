import { dailyReportRepository } from '../repositories/dailyReportRepository.js';
import { employeeRepository } from '../repositories/employeeRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { notificationService } from './notificationService.js';
import { logger } from '../utils/logger.js';

const normalizeRole = (r) => (r || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const resolveRequesterEmployee = async (user) => {
  if (!user || (!user.id && !user.employeeId)) return null;

  if (user.employeeId) {
    const emp = await employeeRepository.findById(user.employeeId);
    if (emp) return emp;
  }

  let emp = await employeeRepository.findByUserId(user.id, user.orgId);
  if (emp) return emp;

  emp = await employeeRepository.findByUserId(user.id);
  if (emp) return emp;

  if (user.email) {
    emp = await employeeRepository.findByEmail(user.email, user.orgId);
    if (emp) return emp;
    emp = await employeeRepository.findByEmail(user.email);
    if (emp) return emp;
  }

  return null;
};

export const dailyReportService = {
  /**
   * Submit or update today's daily work report
   */
  async submitReport(user, data) {
    const employee = await resolveRequesterEmployee(user);
    if (!employee) {
      const err = new Error('No employee profile found for your account.');
      err.statusCode = 404;
      throw err;
    }

    if (!data.workSummary || !data.workSummary.trim()) {
      const err = new Error('Work summary is required.');
      err.statusCode = 400;
      throw err;
    }

    const reportDate = data.reportDate || new Date().toISOString().split('T')[0];

    const saved = await dailyReportRepository.upsertReport({
      orgId: employee.orgId || user.orgId || 'org-1',
      employeeId: employee.id,
      reportDate,
      workSummary: data.workSummary.trim(),
      status: 'SUBMITTED',
    });

    // Notify Reporting Manager (if configured)
    try {
      if (employee.managerId) {
        const mgrEmp = await employeeRepository.findById(employee.managerId);
        let mgrUserId = mgrEmp?.userId || null;
        if (!mgrUserId && mgrEmp?.email) {
          const mgrUser = await userRepository.findByEmail(mgrEmp.email);
          if (mgrUser) mgrUserId = mgrUser.id;
        }

        if (mgrUserId && mgrUserId !== user.id) {
          const empName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || 'Employee';
          await notificationService.createNotification({
            orgId: employee.orgId || user.orgId || 'org-1',
            userId: mgrUserId,
            eventType: 'GENERAL_ALERT',
            title: `Daily Report: ${empName}`,
            message: `${empName} submitted their daily work report for ${reportDate}.`,
            entityType: 'DAILY_WORK_REPORT',
            entityId: saved.id,
            actionUrl: `/daily-reports?tab=team&date=${reportDate}`,
          });
        }
      }
    } catch (notifErr) {
      logger.warn('DailyReportService', `Failed to send report notification: ${notifErr.message}`);
    }

    return saved;
  },

  /**
   * Get employee's report for today
   */
  async getMyTodayReport(user, query = {}) {
    const employee = await resolveRequesterEmployee(user);
    if (!employee) {
      const err = new Error('No employee profile found for your account.');
      err.statusCode = 404;
      throw err;
    }

    const todayStr = query.date || new Date().toISOString().split('T')[0];
    const report = await dailyReportRepository.findByEmployeeAndDate(employee.id, todayStr, employee.orgId);
    return {
      todayDate: todayStr,
      report,
      employeeProfile: {
        id: employee.id,
        name: `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
        employeeCode: employee.employeeCode,
        departmentName: employee.department?.name || '',
      },
    };
  },

  /**
   * Get employee's past reports history
   */
  async getMyReports(user, query = {}) {
    const employee = await resolveRequesterEmployee(user);
    if (!employee) {
      const err = new Error('No employee profile found for your account.');
      err.statusCode = 404;
      throw err;
    }

    return dailyReportRepository.findByEmployeeHistory(employee.id, employee.orgId, query);
  },

  /**
   * Get team/organization daily work reports (for Managers, HR, Admin)
   */
  async getTeamReports(user, query = {}) {
    const normRole = normalizeRole(user.roleName);
    const isHrAdmin = ['admin', 'superadmin', 'hr', 'hrmanager', 'orgadmin'].includes(normRole);
    const isManager = ['manager', 'lead', 'teamlead', 'supervisor'].some((r) => normRole.includes(r));

    if (!isHrAdmin && !isManager) {
      const err = new Error('Access denied: Manager or HR/Admin authorization required.');
      err.statusCode = 403;
      throw err;
    }

    let managerId = null;
    if (isManager && !isHrAdmin) {
      const mgrEmp = await resolveRequesterEmployee(user);
      if (!mgrEmp) {
        return {
          records: [],
          pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
        };
      }
      managerId = mgrEmp.id;
    }

    return dailyReportRepository.findTeamReports({
      orgId: user.orgId || 'org-1',
      managerId,
      deptId: query.deptId || '',
      date: query.date || '',
      startDate: query.startDate || '',
      endDate: query.endDate || '',
      status: query.status || '',
      search: query.search || '',
      page: query.page || 1,
      limit: query.limit || 20,
    });
  },

  /**
   * Get team submission compliance summary
   */
  async getSummary(user, query = {}) {
    const normRole = normalizeRole(user.roleName);
    const isHrAdmin = ['admin', 'superadmin', 'hr', 'hrmanager', 'orgadmin'].includes(normRole);
    const isManager = ['manager', 'lead', 'teamlead', 'supervisor'].some((r) => normRole.includes(r));

    let managerId = null;
    if (isManager && !isHrAdmin) {
      const mgrEmp = await resolveRequesterEmployee(user);
      if (mgrEmp) managerId = mgrEmp.id;
    }

    return dailyReportRepository.getSummary({
      orgId: user.orgId || 'org-1',
      managerId,
      deptId: query.deptId || '',
      date: query.date || null,
    });
  },

  /**
   * Acknowledge report and add manager/HR feedback
   */
  async addFeedback(user, id, data) {
    const report = await dailyReportRepository.findById(id);
    if (!report) {
      const err = new Error('Daily work report not found.');
      err.statusCode = 404;
      throw err;
    }

    const normRole = normalizeRole(user.roleName);
    const isHrAdmin = ['admin', 'superadmin', 'hr', 'hrmanager', 'orgadmin'].includes(normRole);
    const isManager = ['manager', 'lead', 'teamlead', 'supervisor'].some((r) => normRole.includes(r));

    if (!isHrAdmin && !isManager) {
      const err = new Error('Access denied: Only Managers and HR/Admin can acknowledge or add feedback.');
      err.statusCode = 403;
      throw err;
    }

    const updated = await dailyReportRepository.addFeedback(id, {
      managerFeedback: data.feedback ? data.feedback.trim() : 'Acknowledged by manager.',
      reviewedBy: user.id,
    });

    // Notify employee of acknowledgment/feedback
    try {
      const emp = await employeeRepository.findById(report.employeeId);
      let empUserId = emp?.userId || null;
      if (!empUserId && emp?.email) {
        const empUser = await userRepository.findByEmail(emp.email);
        if (empUser) empUserId = empUser.id;
      }

      if (empUserId && empUserId !== user.id) {
        const reviewerName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Your Manager';
        await notificationService.createNotification({
          orgId: report.orgId,
          userId: empUserId,
          eventType: 'GENERAL_ALERT',
          title: 'Daily Report Acknowledged',
          message: `${reviewerName} reviewed and acknowledged your daily work report for ${report.reportDate}.`,
          entityType: 'DAILY_WORK_REPORT',
          entityId: report.id,
          actionUrl: '/daily-reports',
        });
      }
    } catch (notifErr) {
      logger.warn('DailyReportService', `Failed to send acknowledgment notification: ${notifErr.message}`);
    }

    return updated;
  },
};
