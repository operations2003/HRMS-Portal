import { publishedReportRepository } from '../repositories/publishedReportRepository.js';
import { employeeRepository } from '../repositories/employeeRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { notificationRepository } from '../repositories/notificationRepository.js';
import { logger } from '../utils/logger.js';
import { isCeoOrAdmin, checkIsEmployeeCeoOrAdmin } from '../utils/roleUtils.js';

export const publishedReportService = {
  /**
   * Send performance report to the specific employee selected in the form
   */
  async sendReport(reviewerUser, payload) {
    const {
      employeeId,
      department = 'operations',
      reportData = {},
      averageScore = 0,
      overallRating = 'Meets Expectations',
    } = payload;

    if (!employeeId) {
      const err = new Error('Please select an employee before sending the report.');
      err.statusCode = 400;
      throw err;
    }

    const orgId = reviewerUser.orgId || 'org-1';

    // 1. Fetch targeted employee details
    let emp = null;
    try {
      emp = await employeeRepository.findById(employeeId, orgId);
    } catch (e) {
      logger.warn('PublishedReportService', `Failed to find employee ${employeeId}: ${e.message}`);
    }

    if (!emp) {
      const err = new Error('Selected employee was not found in the organization directory.');
      err.statusCode = 404;
      throw err;
    }

    // Enforce business rule: The CEO/Admin must NEVER be a target or reviewee of a performance report
    if (isCeoOrAdmin(emp) || (await checkIsEmployeeCeoOrAdmin(employeeId, orgId))) {
      const err = new Error('Forbidden: The CEO or Administrator cannot be the subject of a performance review.');
      err.statusCode = 400;
      throw err;
    }

    // 2. Resolve employee User ID for notifications and self-service access
    let employeeUserId = emp.userId || emp.user?.id || null;
    if (!employeeUserId && emp.email) {
      try {
        const u = await userRepository.findByEmail(emp.email);
        if (u && u.id) {
          employeeUserId = u.id;
        }
      } catch (err) {
        logger.debug('PublishedReportService', `User lookup by email failed: ${err.message}`);
      }
    }

    const empFullName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || reportData.employeeName || 'Employee';
    const empCode = emp.employeeCode || reportData.employeeId || '';
    const designation = emp.designation?.title || emp.designation?.name || reportData.designation || '';
    const reviewPeriod = reportData.reviewPeriod || '';
    const reviewDate = reportData.reviewDate || new Date().toISOString().split('T')[0];
    const reviewCycle = reportData.reviewCycle || 'Quarterly Review';

    // 3. Persist / upsert the report in published_performance_reports
    const saved = await publishedReportRepository.upsertReport({
      orgId,
      employeeId: emp.id,
      employeeUserId,
      senderId: reviewerUser.employeeId || null,
      senderUserId: reviewerUser.id,
      department,
      employeeName: empFullName,
      employeeCode: empCode,
      designation,
      reviewPeriod,
      reviewDate,
      reviewCycle,
      averageScore: parseFloat(averageScore) || 0,
      overallRating,
      reportData,
    });

    // 4. Send official notification to the selected employee (only to this person)
    if (employeeUserId) {
      try {
        await notificationRepository.create({
          orgId,
          userId: employeeUserId,
          eventType: 'GENERAL_ALERT',
          title: 'Official Performance Review Report Published',
          message: `Your performance review report for ${reviewPeriod || 'the review cycle'} has been finalized and authorized by ${reportData.ceoName || "Sheetal Bedi"}. Average Rating: ${Number(averageScore).toFixed(1)}/5.0 (${overallRating}). You can view and download your signed report in Performance Reports.`,
          entityType: 'PERFORMANCE_REPORT',
          entityId: saved.id,
          actionUrl: '/reports',
        });
        logger.info('PublishedReportService', `Dispatched performance review report notification to user ${employeeUserId} for report ${saved.id}`);
      } catch (notifErr) {
        logger.warn('PublishedReportService', `Failed to deliver notification to user ${employeeUserId}: ${notifErr.message}`);
      }
    }

    return saved;
  },

  /**
   * Get active performance reports delivered to the logged-in user
   */
  async getMyReports(user) {
    const orgId = user.orgId || 'org-1';
    return publishedReportRepository.findActiveForUser({
      userId: user.id,
      employeeId: user.employeeId,
      orgId,
    });
  },

  /**
   * Check status of a report for an employee in a given department
   */
  async getEmployeeReportStatus(reviewerUser, employeeId, department) {
    const orgId = reviewerUser.orgId || 'org-1';
    return publishedReportRepository.findByEmployeeAndDept(orgId, employeeId, department);
  },

  /**
   * Delete / dismiss a performance report by the recipient employee
   */
  async deleteMyReport(user, reportId) {
    const deleted = await publishedReportRepository.markDeletedByUser(reportId, {
      userId: user.id,
      employeeId: user.employeeId,
    });

    if (!deleted) {
      const err = new Error('Report not found or you do not have permission to delete it.');
      err.statusCode = 404;
      throw err;
    }

    return deleted;
  },

  /**
   * List all sent reports for authorized users (Admin, HR, Manager)
   */
  async listSentReports(reviewerUser, { department, employeeId }) {
    const orgId = reviewerUser.orgId || 'org-1';
    return publishedReportRepository.listAllSent({
      orgId,
      department,
      employeeId,
    });
  },

  /**
   * Delete a sent performance report by Admin/HR/Manager
   */
  async deleteSentReport(reviewerUser, reportId) {
    const orgId = reviewerUser.orgId || 'org-1';
    const deleted = await publishedReportRepository.deleteById(reportId, orgId);

    if (!deleted) {
      const err = new Error('Performance report not found or already deleted.');
      err.statusCode = 404;
      throw err;
    }

    logger.info('PublishedReportService', `Report ${reportId} deleted by user ${reviewerUser.id} (${reviewerUser.role})`);
    return deleted;
  },

  /**
   * Update an existing performance report
   */
  async updateReport(reviewerUser, reportId, updatePayload) {
    const orgId = reviewerUser.orgId || 'org-1';
    const existing = await publishedReportRepository.findById(reportId);
    if (!existing || existing.orgId !== orgId) {
      const err = new Error('Performance report not found.');
      err.statusCode = 404;
      throw err;
    }

    const {
      reviewPeriod,
      reviewDate,
      reviewCycle,
      averageScore,
      overallRating,
      reportData,
    } = updatePayload;

    const updated = await publishedReportRepository.updateReport(reportId, orgId, {
      reviewPeriod: reviewPeriod || reportData?.reviewPeriod,
      reviewDate: reviewDate || reportData?.reviewDate,
      reviewCycle: reviewCycle || reportData?.reviewCycle,
      averageScore: averageScore !== undefined ? parseFloat(averageScore) : undefined,
      overallRating: overallRating || reportData?.overallRating,
      reportData,
    });

    if (updated && updated.employeeUserId) {
      try {
        await notificationRepository.create({
          orgId,
          userId: updated.employeeUserId,
          eventType: 'GENERAL_ALERT',
          title: 'Performance Review Report Updated',
          message: `Your performance review report for ${updated.reviewPeriod || 'the review cycle'} has been updated by management. Rating: ${Number(updated.averageScore).toFixed(1)}/5.0 (${updated.overallRating}).`,
          entityType: 'PERFORMANCE_REPORT',
          entityId: updated.id,
          actionUrl: '/reports',
        });
      } catch (notifErr) {
        logger.warn('PublishedReportService', `Failed to deliver update notification: ${notifErr.message}`);
      }
    }

    logger.info('PublishedReportService', `Report ${reportId} updated by user ${reviewerUser.id}`);
    return updated;
  },
};

export default publishedReportService;
