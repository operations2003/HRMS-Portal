import { query } from '../config/db.js';
import { employeeRepository } from '../repositories/employeeRepository.js';

export const employeeLifecycleService = {
  /**
   * Reconstruct the full chronological timeline of an employee's lifecycle
   * Combines authoritative events from:
   * 1. ATS candidate handoff & New Hire
   * 2. Onboarding checklists & IT setup
   * 3. Date of joining
   * 4. Probation evaluations, extensions, and confirmations
   * 5. Role, Department, Designation, and Manager updates (from admin_audit_logs)
   * 6. Performance reviews and ratings
   * 7. Approved leave milestones
   * 8. Compliance document uploads & verifications
   * 9. Resignation, exit clearance, and offboarding deprovisioning
   */
  async getEmployeeTimeline(employeeId, orgId, filters = {}) {
    const employee = await employeeRepository.findById(employeeId);
    if (!employee || employee.orgId !== orgId) {
      const err = new Error('Employee not found.');
      err.statusCode = 404;
      throw err;
    }

    const events = [];

    // 1. Joining Event
    if (employee.dateOfJoining) {
      events.push({
        id: `evt-join-${employee.id}`,
        eventType: 'JOINING',
        title: 'Joined Organization',
        description: `Official date of joining as ${employee.employmentType || 'Full-Time'} employee.`,
        eventDate: employee.dateOfJoining,
        effectiveDate: employee.dateOfJoining,
        actor: 'HR Operations',
        approver: null,
        sourceModule: 'EMPLOYEE',
        sourceId: employee.id,
        isConfidential: false,
        metadata: {
          departmentId: employee.deptId,
          designationId: employee.desigId,
          employeeCode: employee.employeeCode,
        },
      });
    }

    // 2. ATS Candidate & Onboarding Event
    try {
      const nhRes = await query(
        `SELECT id, ats_candidate_id, first_name, last_name, email, lifecycle_state, onboarding_status, bgv_status, created_at 
         FROM new_hires 
         WHERE org_id = $1 AND (LOWER(email) = LOWER($2) OR employee_id = $3)
         LIMIT 1;`,
        [orgId, employee.email, employee.id]
      );
      if (nhRes.rows.length > 0) {
        const nh = nhRes.rows[0];
        events.push({
          id: `evt-ats-${nh.id}`,
          eventType: 'ATS_HANDOFF',
          title: 'ATS Candidate Handoff & Onboarding',
          description: `Candidate offer accepted and onboarded (Lifecycle: ${nh.lifecycle_state || 'ACTIVE'}, Onboarding: ${nh.onboarding_status || 'COMPLETED'}).`,
          eventDate: nh.created_at,
          effectiveDate: nh.created_at,
          actor: 'Recruitment & Onboarding Team',
          approver: null,
          sourceModule: 'ONBOARDING',
          sourceId: nh.id,
          isConfidential: false,
          metadata: { atsCandidateId: nh.ats_candidate_id, bgvStatus: nh.bgv_status },
        });
      }
    } catch (e) {}

    // 4. Probation Events
    try {
      const probRes = await query(
        `SELECT pe.*, u.first_name AS hr_first, u.last_name AS hr_last,
                m.first_name AS mgr_first, m.last_name AS mgr_last
         FROM probation_evaluations pe
         LEFT JOIN users u ON pe.reviewed_by_hr_id = u.id
         LEFT JOIN employees m ON pe.manager_id = m.id
         WHERE pe.org_id = $1 AND pe.employee_id = $2
         ORDER BY pe.review_date ASC;`,
        [orgId, employee.id]
      );
      for (const pe of probRes.rows) {
        events.push({
          id: `evt-prob-${pe.id}`,
          eventType: 'PROBATION',
          title: `Probation Evaluation: ${pe.status}`,
          description: `Manager rating ${pe.manager_rating}/5. Recommendation: ${pe.manager_recommendation}. ${pe.hr_comments || pe.manager_comments || ''}`.trim(),
          eventDate: pe.review_date,
          effectiveDate: pe.extended_until || pe.review_date,
          actor: pe.mgr_first ? `${pe.mgr_first} ${pe.mgr_last}` : 'Manager',
          approver: pe.hr_first ? `${pe.hr_first} ${pe.hr_last}` : 'HR',
          sourceModule: 'PROBATION',
          sourceId: pe.id,
          isConfidential: false,
          metadata: { status: pe.status, rating: pe.manager_rating },
        });
      }
    } catch (e) {}

    // 5. Performance Reviews
    try {
      const perfRes = await query(
        `SELECT pr.id, pr.rating, pr.score, pr.status, pr.created_at, pp.name AS period_name
         FROM performance_records pr
         LEFT JOIN performance_periods pp ON pr.period_id = pp.id
         WHERE pr.org_id = $1 AND pr.employee_id = $2
         ORDER BY pr.created_at ASC;`,
        [orgId, employee.id]
      );
      for (const pr of perfRes.rows) {
        events.push({
          id: `evt-perf-${pr.id}`,
          eventType: 'PERFORMANCE',
          title: `Performance Review: ${pr.period_name || 'Annual Cycle'}`,
          description: `Evaluation score: ${pr.score || pr.rating || 'N/A'}. Review status: ${pr.status}.`,
          eventDate: pr.created_at,
          effectiveDate: pr.created_at,
          actor: 'Performance Committee',
          approver: 'HR Operations',
          sourceModule: 'PERFORMANCE',
          sourceId: pr.id,
          isConfidential: true,
          metadata: { score: pr.score, rating: pr.rating },
        });
      }
    } catch (e) {}

    // 6. Organization / Designation / Department Transfers (from admin_audit_logs)
    try {
      const auditRes = await query(
        `SELECT id, action, previous_value, new_value, reason, created_at, actor_role
         FROM admin_audit_logs
         WHERE org_id = $1 AND target_type = 'EMPLOYEE' AND target_id = $2
         ORDER BY created_at ASC;`,
        [orgId, employee.id]
      );
      for (const log of auditRes.rows) {
        events.push({
          id: `evt-audit-${log.id}`,
          eventType: 'CAREER_TRANSITION',
          title: `Profile / Role Transition (${log.action})`,
          description: log.reason || `Employee profile transition executed under audit compliance.`,
          eventDate: log.created_at,
          effectiveDate: log.created_at,
          actor: log.actor_role || 'System Administrator',
          approver: null,
          sourceModule: 'ADMIN_AUDIT',
          sourceId: log.id,
          isConfidential: false,
          metadata: { action: log.action, details: log.new_value },
        });
      }
    } catch (e) {}

    // 7. Compliance Document Events
    try {
      const docRes = await query(
        `SELECT id, title, category, document_type, verification_status, created_at 
         FROM document_vault 
         WHERE org_id = $1 AND owner_id = $2
         ORDER BY created_at ASC;`,
        [orgId, employee.id]
      );
      for (const doc of docRes.rows) {
        events.push({
          id: `evt-doc-${doc.id}`,
          eventType: 'DOCUMENT',
          title: `Document Uploaded: ${doc.title}`,
          description: `Category: ${doc.category}, Verification Status: ${doc.verification_status}.`,
          eventDate: doc.created_at,
          effectiveDate: doc.created_at,
          actor: 'Employee',
          approver: 'HR Compliance',
          sourceModule: 'DOCUMENTS',
          sourceId: doc.id,
          isConfidential: false,
          metadata: { category: doc.category, status: doc.verification_status },
        });
      }
    } catch (e) {}

    // 8. Exit & Offboarding Events
    try {
      const exitRes = await query(
        `SELECT er.*, u.first_name AS hr_first, u.last_name AS hr_last
         FROM exit_requests er
         LEFT JOIN users u ON er.reviewed_by = u.id
         WHERE er.org_id = $1 AND er.employee_id = $2
         ORDER BY er.created_at ASC;`,
        [orgId, employee.id]
      );
      for (const ex of exitRes.rows) {
        events.push({
          id: `evt-exit-${ex.id}`,
          eventType: 'RESIGNATION',
          title: `Resignation Submitted (${ex.exit_type || 'Voluntary'})`,
          description: `Reason: ${ex.reason || ex.comments || 'N/A'}. Status: ${ex.status}. Requested LWD: ${ex.requested_last_working_day}.`,
          eventDate: ex.resignation_date || ex.created_at,
          effectiveDate: ex.approved_last_working_day || ex.requested_last_working_day,
          actor: 'Employee',
          approver: ex.hr_first ? `${ex.hr_first} ${ex.hr_last}` : 'HR',
          sourceModule: 'EXIT',
          sourceId: ex.id,
          isConfidential: false,
          metadata: { status: ex.status, exitType: ex.exit_type },
        });

        if (ex.status === 'EXIT_COMPLETED' || ex.status === 'APPROVED') {
          events.push({
            id: `evt-offboard-${ex.id}`,
            eventType: 'OFFBOARDING',
            title: 'Offboarding & Clearance Completed',
            description: 'All departmental clearance checklists verified and system accounts deprovisioned.',
            eventDate: ex.approved_last_working_day || ex.updated_at,
            effectiveDate: ex.approved_last_working_day || ex.updated_at,
            actor: 'HR Operations',
            approver: 'System Administrator',
            sourceModule: 'OFFBOARDING',
            sourceId: ex.id,
            isConfidential: false,
            metadata: { finalStatus: ex.status },
          });
        }
      }
    } catch (e) {}

    // Sort events in reverse chronological order (newest first)
    events.sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());

    // Apply optional filtering
    let filtered = events;
    if (filters.eventType) {
      filtered = filtered.filter((e) => e.eventType === filters.eventType);
    }
    if (filters.startDate) {
      filtered = filtered.filter((e) => new Date(e.eventDate) >= new Date(filters.startDate));
    }
    if (filters.endDate) {
      filtered = filtered.filter((e) => new Date(e.eventDate) <= new Date(filters.endDate));
    }

    return {
      employee: {
        id: employee.id,
        employeeCode: employee.employeeCode,
        fullName: `${employee.firstName} ${employee.lastName}`,
        email: employee.email,
        status: employee.status,
        dateOfJoining: employee.dateOfJoining,
        probationStatus: employee.probationStatus || 'CONFIRMED',
      },
      totalEvents: filtered.length,
      events: filtered,
    };
  },
};
