import { exitChecklistRepository } from '../repositories/exitChecklistRepository.js';
import { employeeRepository } from '../repositories/employeeRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { exitRepository } from '../repositories/exitRepository.js';
import { logger } from '../utils/logger.js';

export const exitChecklistService = {
  /**
   * Helper to verify HR or Admin role
   */
  isHrOrAdmin(currentUser) {
    const role = (currentUser.roleName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return ['admin', 'superadmin', 'orgadmin', 'hr', 'hrmanager'].includes(role);
  },

  /**
   * Helper to resolve the employee profile of the authenticated user
   */
  async resolveEmployee(currentUser) {
    let emp = await employeeRepository.findByUserId(currentUser.id, currentUser.orgId);
    if (!emp && currentUser.email) {
      emp = await employeeRepository.findByEmail(currentUser.email, currentUser.orgId);
    }
    return emp;
  },

  /**
   * 1. Initiate exit process and create exit checklist (HR & Admin only)
   */
  async initiateExitChecklist(currentUser, data) {
    if (!this.isHrOrAdmin(currentUser)) {
      const err = new Error('Access denied: Only HR and Admin can create and initiate an employee exit checklist.');
      err.statusCode = 403;
      throw err;
    }

    const emp = await employeeRepository.findById(data.employeeId);
    if (!emp) {
      const err = new Error(`Employee with ID '${data.employeeId}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    if (emp.orgId !== currentUser.orgId) {
      const err = new Error('Access denied: Employee belongs to another organization.');
      err.statusCode = 403;
      throw err;
    }

    if (emp.status === 'Exited' || emp.status === 'Terminated') {
      const err = new Error(`Cannot initiate exit process: Employee profile is already '${emp.status}'.`);
      err.statusCode = 400;
      throw err;
    }

    // Check if an active exit checklist is already in progress
    const existing = await exitChecklistRepository.findActiveByEmployeeId(emp.id, currentUser.orgId);
    if (existing && existing.status === 'In Progress') {
      const err = new Error(
        `An exit checklist is already in progress for ${emp.firstName} ${emp.lastName || ''} (${emp.employeeCode}).`
      );
      err.statusCode = 409;
      throw err;
    }

    // Create the checklist with 5 auto-generated items
    const checklist = await exitChecklistRepository.create({
      orgId: currentUser.orgId,
      employeeId: emp.id,
      resignationDate: data.resignationDate,
      lastWorkingDay: data.lastWorkingDay,
      createdBy: currentUser.id,
      notes: data.notes || '',
    });

    // Update employee profile status to Notice Period if currently Active
    if (emp.status === 'Active') {
      try {
        await employeeRepository.update(emp.id, { status: 'Notice Period' });
      } catch (err) {
        logger.warn('EXIT_CHECKLIST', `Could not update employee status to Notice Period: ${err.message}`);
      }
    }

    logger.info('EXIT_CHECKLIST', `Exit process initiated for employee ${emp.id} by user ${currentUser.id}`);

    return checklist;
  },

  /**
   * 2. Get all organization exit checklists (HR & Admin only)
   */
  async getAllExitChecklists(currentUser, query = {}) {
    if (!this.isHrOrAdmin(currentUser)) {
      const err = new Error('Access denied: Only HR and Admin can view all employees exit checklists.');
      err.statusCode = 403;
      throw err;
    }

    return exitChecklistRepository.findAll({
      orgId: currentUser.orgId,
      employeeId: query.employeeId || null,
      status: query.status || null,
      search: query.search || null,
      limit: query.limit ? parseInt(query.limit, 10) : 100,
      offset: query.offset ? parseInt(query.offset, 10) : 0,
    });
  },

  /**
   * 3. Get employee's own exit checklist (Employee self-service)
   */
  async getMyExitChecklist(currentUser) {
    const emp = await this.resolveEmployee(currentUser);
    if (!emp) {
      return {
        checklist: null,
        message: 'No employee profile linked to your user account.',
      };
    }

    const checklist = await exitChecklistRepository.findActiveByEmployeeId(emp.id, currentUser.orgId);
    if (!checklist) {
      return {
        checklist: null,
        message: 'No exit process has been initiated for your profile.',
      };
    }

    return {
      checklist,
    };
  },

  /**
   * 4. Get exit checklist by ID (HR/Admin can view all; Employee can ONLY view own)
   */
  async getExitChecklistById(currentUser, id) {
    const checklist = await exitChecklistRepository.findById(id);
    if (!checklist) {
      const err = new Error(`Exit checklist '${id}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    if (checklist.orgId !== currentUser.orgId) {
      const err = new Error('Access denied: Checklist belongs to another organization.');
      err.statusCode = 403;
      throw err;
    }

    // Role security barrier
    if (!this.isHrOrAdmin(currentUser)) {
      const emp = await this.resolveEmployee(currentUser);
      if (!emp || emp.id !== checklist.employeeId) {
        const err = new Error('Access denied: You are not authorized to view another employee exit checklist.');
        err.statusCode = 403;
        throw err;
      }
    }

    return checklist;
  },

  /**
   * 5. Update checklist item status (HR & Admin only)
   */
  async updateChecklistItemStatus(currentUser, checklistId, itemId, data) {
    if (!this.isHrOrAdmin(currentUser)) {
      const err = new Error('Access denied: Only HR and Admin can edit exit checklist items.');
      err.statusCode = 403;
      throw err;
    }

    const item = await exitChecklistRepository.findItemById(itemId);
    if (!item) {
      const err = new Error(`Checklist item '${itemId}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    if (item.checklist_id !== checklistId) {
      const err = new Error(`Item does not belong to checklist '${checklistId}'.`);
      err.statusCode = 400;
      throw err;
    }

    if (item.org_id !== currentUser.orgId) {
      const err = new Error('Access denied: Item belongs to another organization.');
      err.statusCode = 403;
      throw err;
    }

    if (item.checklist_status === 'Completed') {
      const err = new Error('Cannot modify item: Exit checklist has already been marked as Completed.');
      err.statusCode = 400;
      throw err;
    }

    const formattedStatus =
      data.status.charAt(0).toUpperCase() + data.status.slice(1).toLowerCase();

    await exitChecklistRepository.updateItemStatus(itemId, {
      status: formattedStatus,
      completedBy: formattedStatus === 'Completed' ? currentUser.id : null,
      notes: data.notes !== undefined ? data.notes : null,
    });

    return exitChecklistRepository.findById(checklistId);
  },

  /**
   * 6. Mark entire exit process as completed (HR & Admin only)
   * Only allowed when ALL 5 checklist items are completed!
   */
  async completeExitChecklist(currentUser, checklistId, data = {}) {
    if (!this.isHrOrAdmin(currentUser)) {
      const err = new Error('Access denied: Only HR and Admin can mark the exit process as completed.');
      err.statusCode = 403;
      throw err;
    }

    const checklist = await exitChecklistRepository.findById(checklistId);
    if (!checklist) {
      const err = new Error(`Exit checklist '${checklistId}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    if (checklist.orgId !== currentUser.orgId) {
      const err = new Error('Access denied: Checklist belongs to another organization.');
      err.statusCode = 403;
      throw err;
    }

    if (checklist.status === 'Completed') {
      return {
        message: 'Exit process is already marked as completed.',
        checklist,
      };
    }

    // Enforce Rule 8: All five checklist items must be completed!
    const pendingItems = (checklist.items || []).filter((i) => i.status !== 'Completed');
    if (pendingItems.length > 0) {
      const pendingTitles = pendingItems.map((i) => i.title).join(', ');
      const err = new Error(
        `Cannot mark exit process as completed: All five checklist items must be completed first. Pending items: ${pendingTitles}.`
      );
      err.statusCode = 400;
      throw err;
    }

    // 1. Mark checklist Completed
    const completedChecklist = await exitChecklistRepository.markChecklistCompleted(
      checklistId,
      currentUser.id
    );

    // 2. Mark Employee profile as Exited
    const emp = await employeeRepository.findById(checklist.employeeId);
    if (emp) {
      await employeeRepository.update(emp.id, { status: 'Exited' });

      // 3. Deactivate portal user account if linked
      if (emp.userId) {
        try {
          await userRepository.update(emp.userId, { status: 'Inactive' });
        } catch (uErr) {
          logger.warn('EXIT_CHECKLIST', `Could not deactivate user account for employee ${emp.id}: ${uErr.message}`);
        }
      }
    }

    // 4. Synchronize legacy exit_requests if active record exists
    try {
      const legacyExit = await exitRepository.findByEmployeeId(checklist.employeeId, currentUser.orgId);
      if (legacyExit && ['APPROVED', 'NOTICE_PERIOD', 'CLEARANCE_IN_PROGRESS', 'EXIT_PROCESSING'].includes(legacyExit.status)) {
        await exitRepository.update(legacyExit.id, {
          status: 'COMPLETED',
          currentStage: 'COMPLETED',
        });
      }
    } catch {
      // Ignore legacy sync if not applicable
    }

    logger.info('EXIT_CHECKLIST', `Exit process marked as completed for checklist ${checklistId} by user ${currentUser.id}`);

    return {
      message: 'Exit process successfully completed. Employee status updated to Exited.',
      checklist: completedChecklist,
    };
  },

  /**
   * 7. Delete / Cancel exit checklist (HR & Admin only)
   */
  async deleteExitChecklist(currentUser, checklistId) {
    if (!this.isHrOrAdmin(currentUser)) {
      const err = new Error('Access denied: Only HR and Admin can delete an exit checklist.');
      err.statusCode = 403;
      throw err;
    }

    const checklist = await exitChecklistRepository.findById(checklistId);
    if (!checklist) {
      const err = new Error(`Exit checklist '${checklistId}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    if (checklist.orgId !== currentUser.orgId) {
      const err = new Error('Access denied.');
      err.statusCode = 403;
      throw err;
    }

    await exitChecklistRepository.deleteChecklist(checklistId);

    return {
      message: 'Exit checklist deleted successfully.',
    };
  },
};
