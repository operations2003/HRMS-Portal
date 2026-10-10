import { pool } from '../config/db.js';
import { nanoid } from 'nanoid';
import rosterParserService from '../services/rosterParserService.js';
import employeeMatchingService from '../services/employeeMatchingService.js';

const sendSuccess = (res, message, data = {}) => {
  return res.status(200).json({ success: true, message, data });
};

const sendError = (res, message, statusCode = 400, errors = []) => {
  return res.status(statusCode).json({ success: false, message, errors });
};

/**
 * POST /api/v1/roster/upload
 * Upload and parse roster file (preview mode)
 */
export const uploadRoster = async (req, res, next) => {
  try {
    const { month, year } = req.body;
    const orgId = req.user?.orgId || req.user?.org?.id || 'org-1';
    const userId = req.user?.id;

    if (!req.file) {
      return sendError(res, 'No file uploaded. Please select an Excel (.xlsx, .xls) or CSV file.');
    }

    if (!month || !year) {
      return sendError(res, 'Month and year are required.');
    }

    const selectedMonth = parseInt(month, 10);
    const selectedYear = parseInt(year, 10);

    if (isNaN(selectedMonth) || selectedMonth < 1 || selectedMonth > 12) {
      return sendError(res, 'Invalid month. Must be between 1 and 12.');
    }

    if (isNaN(selectedYear) || selectedYear < 2020 || selectedYear > 2100) {
      return sendError(res, 'Invalid year. Must be between 2020 and 2100.');
    }

    // Parse roster file
    const fileBuffer = req.file.buffer;
    const filename = req.file.originalname;

    const parsedRoster = rosterParserService.parseRosterFile(
      fileBuffer,
      filename,
      selectedMonth,
      selectedYear
    );

    // Validate roster
    const validation = rosterParserService.validateRoster(parsedRoster);
    if (!validation.isValid) {
      return sendError(res, 'Roster spreadsheet contains syntax or format errors.', 400, validation.errors);
    }

    // Match employees against existing HRMS records
    const matchingResult = await employeeMatchingService.matchEmployees(
      parsedRoster.employees,
      orgId
    );

    // Fetch existing shift assignments for this organization and month to generate diff
    const existingAssignmentsRes = await pool.query(
      `SELECT id, employee_id, assignment_date, shift_type, shift_start_time, shift_end_time, shift_label
       FROM shift_assignments
       WHERE org_id = $1 
         AND EXTRACT(MONTH FROM assignment_date) = $2
         AND EXTRACT(YEAR FROM assignment_date) = $3`,
      [orgId, selectedMonth, selectedYear]
    );

    const existingMap = new Map();
    existingAssignmentsRes.rows.forEach((row) => {
      const dateKey = typeof row.assignment_date === 'string'
        ? row.assignment_date.split('T')[0]
        : row.assignment_date.toISOString().split('T')[0];
      existingMap.set(`${row.employee_id}_${dateKey}`, row);
    });

    // Check for existing punch records in attendance for the month
    const existingAttendanceRes = await pool.query(
      `SELECT a.employee_id, a.attendance_date, a.check_in, a.check_out, a.status
       FROM attendance_records a
       JOIN employees e ON a.employee_id = e.id
       WHERE e.org_id = $1
         AND EXTRACT(MONTH FROM a.attendance_date) = $2
         AND EXTRACT(YEAR FROM a.attendance_date) = $3
         AND a.check_in IS NOT NULL`,
      [orgId, selectedMonth, selectedYear]
    );

    const attendanceMap = new Map();
    existingAttendanceRes.rows.forEach((row) => {
      const dateKey = typeof row.attendance_date === 'string'
        ? row.attendance_date.split('T')[0]
        : row.attendance_date.toISOString().split('T')[0];
      attendanceMap.set(`${row.employee_id}_${dateKey}`, row);
    });

    // Enrich daily assignments with diff status (NEW, CHANGED, UNCHANGED, UNSPECIFIED)
    let previewNewCount = 0;
    let previewChangedCount = 0;
    let previewUnchangedCount = 0;
    let attendanceConflictCount = 0;

    for (const emp of parsedRoster.employees) {
      const mapping = matchingResult.mappings.find(
        (m) => m.rosterEmployeeName === emp.rosterEmployeeName
      );
      const matchedEmpId = mapping?.matchedEmployeeId;

      for (const day of emp.dailyAssignments) {
        if (day.shiftType === 'BLANK') {
          day.diffStatus = 'UNSPECIFIED';
          continue;
        }

        if (!matchedEmpId) {
          day.diffStatus = 'UNMATCHED_EMP';
          continue;
        }

        const key = `${matchedEmpId}_${day.date}`;
        const existing = existingMap.get(key);
        const existingAtt = attendanceMap.get(key);

        if (existingAtt) {
          day.hasExistingAttendance = true;
          day.attendancePunch = {
            checkIn: existingAtt.check_in,
            checkOut: existingAtt.check_out,
            status: existingAtt.status
          };
        }

        if (!existing) {
          day.diffStatus = 'NEW';
          previewNewCount++;
        } else {
          // Compare values
          const isSameType = existing.shift_type === day.shiftType;
          const isSameStart = (existing.shift_start_time || '').slice(0, 5) === (day.shiftStartTime || '').slice(0, 5);
          const isSameEnd = (existing.shift_end_time || '').slice(0, 5) === (day.shiftEndTime || '').slice(0, 5);

          if (isSameType && isSameStart && isSameEnd) {
            day.diffStatus = 'UNCHANGED';
            previewUnchangedCount++;
          } else {
            day.diffStatus = 'CHANGED';
            day.previousAssignment = {
              shiftType: existing.shift_type,
              shiftLabel: existing.shift_label,
              shiftStartTime: existing.shift_start_time,
              shiftEndTime: existing.shift_end_time
            };
            previewChangedCount++;

            if (existingAtt) {
              attendanceConflictCount++;
              day.attendanceConflict = true;
            }
          }
        }
      }
    }

    const diffSummary = {
      newAssignments: previewNewCount,
      changedAssignments: previewChangedCount,
      unchangedAssignments: previewUnchangedCount,
      attendanceConflicts: attendanceConflictCount,
      workingDaysDiscrepancies: parsedRoster.employees.filter((e) => e.hasWorkingDaysDiscrepancy).length
    };

    // Create import job record (PENDING status)
    const jobId = `job-${nanoid()}`;

    await pool.query(
      `INSERT INTO roster_import_jobs (
        id, org_id, uploaded_by, original_filename, roster_month, roster_year,
        status, total_employees, matched_employees, unmatched_employees,
        total_assignments, new_assignments, updated_assignments, unchanged_assignments,
        file_metadata, import_summary
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        jobId,
        orgId,
        userId,
        filename,
        selectedMonth,
        selectedYear,
        'PENDING',
        matchingResult.totalRosterEmployees,
        matchingResult.matchedCount,
        matchingResult.unmatchedCount,
        previewNewCount + previewChangedCount + previewUnchangedCount,
        previewNewCount,
        previewChangedCount,
        previewUnchangedCount,
        JSON.stringify({ filename, fileSize: req.file.size }),
        JSON.stringify({ parsedRoster, matchingResult, validation, diffSummary })
      ]
    );

    // Save employee mappings
    for (const mapping of matchingResult.mappings) {
      await pool.query(
        `INSERT INTO roster_employee_mappings (
          id, import_job_id, roster_employee_name, roster_designation,
          matched_employee_id, match_confidence, match_method, is_ambiguous,
          alternative_matches
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          mapping.id,
          jobId,
          mapping.rosterEmployeeName,
          mapping.rosterDesignation,
          mapping.matchedEmployeeId,
          mapping.matchConfidence,
          mapping.matchMethod,
          mapping.isAmbiguous,
          JSON.stringify(mapping.alternativeMatches || [])
        ]
      );
    }

    return sendSuccess(res, 'Roster file uploaded and parsed successfully. Review preview before confirming.', {
      jobId,
      parsedRoster,
      matchingResult,
      validation,
      diffSummary,
      requiresReview: matchingResult.unmatchedCount > 0 || matchingResult.ambiguousCount > 0 || attendanceConflictCount > 0
    });
  } catch (err) {
    console.error('Roster upload error:', err);
    return sendError(res, err.message || 'Failed to upload roster file.', 500);
  }
};

/**
 * GET /api/v1/roster/preview/:jobId
 * Get preview of uploaded roster
 */
export const getPreview = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const orgId = req.user?.orgId || req.user?.org?.id;

    const jobResult = await pool.query(
      `SELECT * FROM roster_import_jobs WHERE id = $1 AND org_id = $2`,
      [jobId, orgId]
    );

    if (jobResult.rows.length === 0) {
      return sendError(res, 'Roster import job not found.', 404);
    }

    const job = jobResult.rows[0];
    const importSummary = job.import_summary;

    // Get current mappings (including any that were manually resolved)
    const mappingsResult = await pool.query(
      `SELECT 
        rem.*,
        e.first_name || ' ' || e.last_name as matched_employee_name,
        e.employee_code as matched_employee_code,
        d.title as matched_employee_designation
       FROM roster_employee_mappings rem
       LEFT JOIN employees e ON rem.matched_employee_id = e.id
       LEFT JOIN designations d ON e.desig_id = d.id
       WHERE rem.import_job_id = $1
       ORDER BY rem.roster_employee_name`,
      [jobId]
    );

    // Sync mappings with parsed data
    const mappings = mappingsResult.rows;

    return sendSuccess(res, 'Roster preview retrieved successfully.', {
      job,
      ...importSummary,
      mappings
    });
  } catch (err) {
    console.error('Preview error:', err);
    return sendError(res, 'Failed to retrieve roster preview.', 500);
  }
};

/**
 * POST /api/v1/roster/resolve-ambiguity
 * Resolve ambiguous employee mapping
 */
export const resolveAmbiguity = async (req, res, next) => {
  try {
    const { mappingId, selectedEmployeeId } = req.body;
    const userId = req.user?.id;

    if (!mappingId || !selectedEmployeeId) {
      return sendError(res, 'Mapping ID and selected employee ID are required.');
    }

    // Verify employee exists and is active
    const empRes = await pool.query(
      `SELECT id, first_name, last_name, employee_code FROM employees WHERE id = $1 AND status = 'Active'`,
      [selectedEmployeeId]
    );
    if (empRes.rows.length === 0) {
      return sendError(res, 'Selected employee not found or inactive.', 404);
    }
    const emp = empRes.rows[0];
    const fullName = `${emp.first_name} ${emp.last_name}`.trim();

    // Update mapping record
    const updateResult = await pool.query(
      `UPDATE roster_employee_mappings
       SET matched_employee_id = $1,
           match_method = 'MANUAL',
           is_ambiguous = FALSE,
           resolved_by = $2,
           resolved_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [selectedEmployeeId, userId, mappingId]
    );

    if (updateResult.rows.length === 0) {
      return sendError(res, 'Mapping not found.', 404);
    }

    const updatedMapping = updateResult.rows[0];

    // Also update import_summary in the job to reflect resolution
    const jobRes = await pool.query(
      `SELECT id, import_summary FROM roster_import_jobs WHERE id = $1`,
      [updatedMapping.import_job_id]
    );

    if (jobRes.rows.length > 0) {
      const summary = jobRes.rows[0].import_summary;
      if (summary && summary.matchingResult) {
        const ambIndex = summary.matchingResult.ambiguous?.findIndex(a => a.id === mappingId);
        if (ambIndex !== -1 && ambIndex !== undefined) {
          const item = summary.matchingResult.ambiguous[ambIndex];
          item.matchedEmployeeId = selectedEmployeeId;
          item.matchedEmployeeName = fullName;
          item.isAmbiguous = false;
          item.resolvedAt = new Date().toISOString();
        }
        await pool.query(
          `UPDATE roster_import_jobs SET import_summary = $1 WHERE id = $2`,
          [JSON.stringify(summary), updatedMapping.import_job_id]
        );
      }
    }

    return sendSuccess(res, `Employee mapped to ${fullName} (${emp.employee_code}) successfully.`, {
      mapping: {
        ...updatedMapping,
        matchedEmployeeName: fullName,
        matchedEmployeeCode: emp.employee_code
      }
    });
  } catch (err) {
    console.error('Resolve ambiguity error:', err);
    return sendError(res, 'Failed to resolve employee mapping.', 500);
  }
};

/**
 * POST /api/v1/roster/confirm/:jobId
 * Confirm and apply roster import to database transactionally
 */
export const confirmImport = async (req, res, next) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { jobId } = req.params;
    const orgId = req.user?.orgId || req.user?.org?.id;
    const userId = req.user?.id;

    // Get job and check status
    const jobResult = await client.query(
      `SELECT * FROM roster_import_jobs WHERE id = $1 AND org_id = $2 FOR UPDATE`,
      [jobId, orgId]
    );

    if (jobResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 'Roster import job not found.', 404);
    }

    const job = jobResult.rows[0];

    if (job.status === 'CONFIRMED') {
      await client.query('ROLLBACK');
      return sendError(res, 'This roster import has already been confirmed and applied.');
    }

    // Get all mappings
    const mappingsResult = await client.query(
      `SELECT * FROM roster_employee_mappings WHERE import_job_id = $1`,
      [jobId]
    );

    const mappings = mappingsResult.rows;
    const importSummary = job.import_summary || {};
    const parsedRoster = importSummary.parsedRoster;

    if (!parsedRoster || !parsedRoster.employees) {
      await client.query('ROLLBACK');
      return sendError(res, 'Parsed roster data missing from import job.', 400);
    }

    // Check for unresolved ambiguities
    const unresolvedAmbiguous = mappings.filter((m) => m.is_ambiguous && !m.resolved_at);
    if (unresolvedAmbiguous.length > 0) {
      await client.query('ROLLBACK');
      return sendError(
        res,
        `Cannot confirm import. ${unresolvedAmbiguous.length} ambiguous employee mapping(s) require manual resolution.`,
        400
      );
    }

    let newAssignments = 0;
    let updatedAssignments = 0;
    let unchangedAssignments = 0;
    const errors = [];
    const flaggedReviewRecords = [];

    // Process each mapping and its daily assignments
    for (const mapping of mappings) {
      if (!mapping.matched_employee_id) {
        continue; // Unmatched employees are safely skipped
      }

      const employeeId = mapping.matched_employee_id;
      const rosterEmp = parsedRoster.employees.find(
        (e) => e.rosterEmployeeName === mapping.roster_employee_name
      );

      if (!rosterEmp) continue;

      for (const day of rosterEmp.dailyAssignments) {
        // Skip blank / unspecified cells - do NOT remove or alter existing assignments
        if (day.shiftType === 'BLANK') {
          continue;
        }

        try {
          // Check if assignment exists
          const existingResult = await client.query(
            `SELECT * FROM shift_assignments 
             WHERE employee_id = $1 AND assignment_date = $2`,
            [employeeId, day.date]
          );

          // Check if an existing punch record is present in attendance_records
          const attResult = await client.query(
            `SELECT id, check_in, check_out, status FROM attendance_records
             WHERE employee_id = $1 AND attendance_date = $2`,
            [employeeId, day.date]
          );
          const hasActiveAttendance = attResult.rows.length > 0 && attResult.rows[0].check_in !== null;

          if (existingResult.rows.length === 0) {
            // Create new assignment
            const assignmentId = `assign-${nanoid()}`;

            await client.query(
              `INSERT INTO shift_assignments (
                id, org_id, employee_id, assignment_date, shift_type,
                shift_start_time, shift_end_time, shift_label, is_overnight,
                source, import_job_id, created_by
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
              [
                assignmentId,
                orgId,
                employeeId,
                day.date,
                day.shiftType,
                day.shiftStartTime,
                day.shiftEndTime,
                day.shiftLabel,
                day.isOvernight,
                'IMPORT',
                jobId,
                userId
              ]
            );

            // Audit trail
            await client.query(
              `INSERT INTO shift_assignment_audit (
                id, shift_assignment_id, employee_id, assignment_date,
                change_type, new_value, changed_by, change_source, import_job_id
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              [
                `audit-${nanoid()}`,
                assignmentId,
                employeeId,
                day.date,
                'CREATED',
                JSON.stringify({
                  shiftType: day.shiftType,
                  shiftLabel: day.shiftLabel,
                  shiftStartTime: day.shiftStartTime,
                  shiftEndTime: day.shiftEndTime,
                  isOvernight: day.isOvernight
                }),
                userId,
                'IMPORT',
                jobId
              ]
            );

            newAssignments++;
          } else {
            // Compare and update if changed
            const existing = existingResult.rows[0];

            const hasChanged =
              existing.shift_type !== day.shiftType ||
              (existing.shift_start_time || '').slice(0, 5) !== (day.shiftStartTime || '').slice(0, 5) ||
              (existing.shift_end_time || '').slice(0, 5) !== (day.shiftEndTime || '').slice(0, 5);

            if (hasChanged) {
              if (hasActiveAttendance) {
                flaggedReviewRecords.push({
                  employeeId,
                  employeeName: mapping.roster_employee_name,
                  date: day.date,
                  attendanceId: attResult.rows[0].id,
                  oldShift: existing.shift_label,
                  newShift: day.shiftLabel,
                  reason: 'Shift modified for date with existing attendance punch'
                });
              }

              await client.query(
                `UPDATE shift_assignments
                 SET shift_type = $1, shift_start_time = $2, shift_end_time = $3,
                     shift_label = $4, is_overnight = $5, source = 'IMPORT',
                     import_job_id = $6, updated_by = $7, updated_at = NOW()
                 WHERE id = $8`,
                [
                  day.shiftType,
                  day.shiftStartTime,
                  day.shiftEndTime,
                  day.shiftLabel,
                  day.isOvernight,
                  jobId,
                  userId,
                  existing.id
                ]
              );

              // Audit trail
              await client.query(
                `INSERT INTO shift_assignment_audit (
                  id, shift_assignment_id, employee_id, assignment_date,
                  change_type, old_value, new_value, changed_by, change_source, import_job_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [
                  `audit-${nanoid()}`,
                  existing.id,
                  employeeId,
                  day.date,
                  'UPDATED',
                  JSON.stringify({
                    shiftType: existing.shift_type,
                    shiftLabel: existing.shift_label,
                    shiftStartTime: existing.shift_start_time,
                    shiftEndTime: existing.shift_end_time
                  }),
                  JSON.stringify({
                    shiftType: day.shiftType,
                    shiftLabel: day.shiftLabel,
                    shiftStartTime: day.shiftStartTime,
                    shiftEndTime: day.shiftEndTime,
                    isOvernight: day.isOvernight
                  }),
                  userId,
                  'IMPORT',
                  jobId
                ]
              );

              updatedAssignments++;
            } else {
              unchangedAssignments++;
            }
          }
        } catch (err) {
          console.error(`Assignment error for ${mapping.roster_employee_name} on ${day.date}:`, err);
          errors.push(`${mapping.roster_employee_name} (${day.date}): ${err.message}`);
        }
      }
    }

    // Update job status to CONFIRMED or PARTIAL
    const finalStatus = errors.length > 0 ? 'PARTIAL' : 'CONFIRMED';
    const updatedSummary = {
      ...importSummary,
      flaggedReviewRecords
    };

    await client.query(
      `UPDATE roster_import_jobs
       SET status = $1,
           new_assignments = $2,
           updated_assignments = $3,
           unchanged_assignments = $4,
           invalid_entries = $5,
           error_summary = $6,
           import_summary = $7,
           confirmed_at = NOW(),
           confirmed_by = $8
       WHERE id = $9`,
      [
        finalStatus,
        newAssignments,
        updatedAssignments,
        unchangedAssignments,
        errors.length,
        JSON.stringify(errors),
        JSON.stringify(updatedSummary),
        userId,
        jobId
      ]
    );

    await client.query('COMMIT');

    return sendSuccess(res, 'Monthly roster synchronized successfully with HRMS.', {
      jobId,
      status: finalStatus,
      newAssignments,
      updatedAssignments,
      unchangedAssignments,
      totalProcessed: newAssignments + updatedAssignments + unchangedAssignments,
      flaggedReviewCount: flaggedReviewRecords.length,
      flaggedReviewRecords,
      errors: errors.length > 0 ? errors : null
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Confirm import error:', err);
    return sendError(res, err.message || 'Failed to confirm roster import.', 500);
  } finally {
    client.release();
  }
};

/**
 * GET /api/v1/roster/history
 * Get roster import history
 */
export const getImportHistory = async (req, res, next) => {
  try {
    const orgId = req.user?.orgId || req.user?.org?.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);

    const result = await pool.query(
      `SELECT 
        rij.*,
        u.first_name || ' ' || u.last_name as uploaded_by_name,
        cu.first_name || ' ' || cu.last_name as confirmed_by_name
       FROM roster_import_jobs rij
       LEFT JOIN users u ON rij.uploaded_by = u.id
       LEFT JOIN users cu ON rij.confirmed_by = cu.id
       WHERE rij.org_id = $1
       ORDER BY rij.created_at DESC
       LIMIT $2 OFFSET $3`,
      [orgId, limit, offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM roster_import_jobs WHERE org_id = $1`,
      [orgId]
    );

    return sendSuccess(res, 'Import history retrieved successfully.', {
      imports: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count, 10),
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count, 10) / limit)
      }
    });
  } catch (err) {
    console.error('Import history error:', err);
    return sendError(res, 'Failed to retrieve import history.', 500);
  }
};

/**
 * GET /api/v1/roster/assignments
 * Get shift assignments with role-based scoping (Employee: self, Manager: team, HR/Admin: all)
 */
export const getAssignments = async (req, res, next) => {
  try {
    const orgId = req.user?.orgId || req.user?.org?.id;
    const { employeeId, startDate, endDate, month, year, deptId } = req.query;

    const userRoleStr = (req.user?.roleName || req.user?.role?.name || req.user?.role || '').toLowerCase();
    const isAdminOrHR = userRoleStr.includes('admin') || userRoleStr.includes('hr');
    const isManager = userRoleStr.includes('manager');
    const userEmpId = req.user?.employeeId || req.user?.employee?.id;

    let query = `
      SELECT 
        sa.*,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.email,
        d.title as designation_title,
        dep.name as department_name
      FROM shift_assignments sa
      JOIN employees e ON sa.employee_id = e.id
      LEFT JOIN designations d ON e.desig_id = d.id
      LEFT JOIN departments dep ON e.dept_id = dep.id
      WHERE sa.org_id = $1
    `;
    const params = [orgId];

    // RBAC Scoping
    if (!isAdminOrHR) {
      if (isManager && userEmpId) {
        // Manager can view their direct reports and themselves
        params.push(userEmpId);
        query += ` AND (e.manager_id = $${params.length} OR e.id = $${params.length})`;
      } else if (userEmpId) {
        // Regular employee can only view their own schedule
        params.push(userEmpId);
        query += ` AND sa.employee_id = $${params.length}`;
      } else {
        // Unknown employee context
        return sendSuccess(res, 'No assignments found.', { assignments: [] });
      }
    } else if (employeeId) {
      // HR/Admin specific employee filter
      params.push(employeeId);
      query += ` AND sa.employee_id = $${params.length}`;
    }

    if (deptId) {
      params.push(deptId);
      query += ` AND e.dept_id = $${params.length}`;
    }

    if (month && year) {
      const parsedMonth = parseInt(month, 10);
      const parsedYear = parseInt(year, 10);
      const firstDay = `${parsedYear}-${String(parsedMonth).padStart(2, '0')}-01`;
      const lastDay = new Date(parsedYear, parsedMonth, 0).getDate();
      const lastDayStr = `${parsedYear}-${String(parsedMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      params.push(firstDay, lastDayStr);
      query += ` AND sa.assignment_date BETWEEN $${params.length - 1} AND $${params.length}`;
    } else if (startDate && endDate) {
      params.push(startDate, endDate);
      query += ` AND sa.assignment_date BETWEEN $${params.length - 1} AND $${params.length}`;
    }

    query += ` ORDER BY sa.assignment_date ASC, e.last_name ASC, e.first_name ASC`;

    const result = await pool.query(query, params);

    return sendSuccess(res, 'Shift assignments retrieved successfully.', {
      assignments: result.rows
    });
  } catch (err) {
    console.error('Get assignments error:', err);
    return sendError(res, 'Failed to retrieve shift assignments.', 500);
  }
};

export default {
  uploadRoster,
  getPreview,
  resolveAmbiguity,
  confirmImport,
  getImportHistory,
  getAssignments
};
