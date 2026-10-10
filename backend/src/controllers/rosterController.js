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
      return sendError(res, 'No file uploaded. Please select an Excel (.xlsx) or CSV file.');
    }

    if (!month || !year) {
      return sendError(res, 'Month and year are required.');
    }

    const selectedMonth = parseInt(month);
    const selectedYear = parseInt(year);

    if (selectedMonth < 1 || selectedMonth > 12) {
      return sendError(res, 'Invalid month. Must be between 1 and 12.');
    }

    if (selectedYear < 2020 || selectedYear > 2100) {
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
      return sendError(res, 'Roster file contains errors.', 400, validation.errors);
    }

    // Match employees
    const matchingResult = await employeeMatchingService.matchEmployees(
      parsedRoster.employees,
      orgId
    );

    // Create import job record (PENDING status)
    const jobId = `job-${nanoid()}`;
    
    await pool.query(
      `INSERT INTO roster_import_jobs (
        id, org_id, uploaded_by, original_filename, roster_month, roster_year,
        status, total_employees, matched_employees, unmatched_employees,
        file_metadata, import_summary
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
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
        JSON.stringify({ filename, fileSize: req.file.size }),
        JSON.stringify({ parsedRoster, matchingResult, validation })
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
      requiresReview: matchingResult.unmatchedCount > 0 || matchingResult.ambiguousCount > 0
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

    // Get mappings
    const mappingsResult = await pool.query(
      `SELECT * FROM roster_employee_mappings WHERE import_job_id = $1 ORDER BY roster_employee_name`,
      [jobId]
    );

    return sendSuccess(res, 'Roster preview retrieved successfully.', {
      job,
      ...importSummary,
      mappings: mappingsResult.rows
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

    await pool.query(
      `UPDATE roster_employee_mappings
       SET matched_employee_id = $1,
           match_method = 'MANUAL',
           is_ambiguous = FALSE,
           resolved_by = $2,
           resolved_at = NOW()
       WHERE id = $3`,
      [selectedEmployeeId, userId, mappingId]
    );

    return sendSuccess(res, 'Employee mapping resolved successfully.');

  } catch (err) {
    console.error('Resolve ambiguity error:', err);
    return sendError(res, 'Failed to resolve employee mapping.', 500);
  }
};

/**
 * POST /api/v1/roster/confirm/:jobId
 * Confirm and apply roster import
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
      `SELECT * FROM roster_import_jobs WHERE id = $1 AND org_id = $2`,
      [jobId, orgId]
    );

    if (jobResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return sendError(res, 'Roster import job not found.', 404);
    }

    const job = jobResult.rows[0];

    if (job.status === 'CONFIRMED') {
      await client.query('ROLLBACK');
      return sendError(res, 'This roster has already been confirmed and applied.');
    }

    // Get all mappings
    const mappingsResult = await client.query(
      `SELECT * FROM roster_employee_mappings WHERE import_job_id = $1`,
      [jobId]
    );

    const mappings = mappingsResult.rows;
    const importSummary = job.import_summary;
    const parsedRoster = importSummary.parsedRoster;

    // Check for unresolved ambiguities
    const unresolvedAmbiguous = mappings.filter(m => m.is_ambiguous && !m.resolved_at);
    if (unresolvedAmbiguous.length > 0) {
      await client.query('ROLLBACK');
      return sendError(res, `Cannot confirm import. ${unresolvedAmbiguous.length} ambiguous employee mappings need to be resolved.`);
    }

    let newAssignments = 0;
    let updatedAssignments = 0;
    let unchangedAssignments = 0;
    const errors = [];

    // Process each mapping
    for (const mapping of mappings) {
      if (!mapping.matched_employee_id) {
        continue; // Skip unmatched employees
      }

      const employeeId = mapping.matched_employee_id;
      const rosterEmp = parsedRoster.employees.find(
        e => e.rosterEmployeeName === mapping.roster_employee_name
      );

      if (!rosterEmp) continue;

      // Process daily assignments
      for (const day of rosterEmp.dailyAssignments) {
        if (day.shiftType === 'BLANK') {
          continue; // Skip blank cells
        }

        try {
          // Check if assignment exists
          const existingResult = await client.query(
            `SELECT * FROM shift_assignments 
             WHERE employee_id = $1 AND assignment_date = $2`,
            [employeeId, day.date]
          );

          const assignmentId = `assign-${nanoid()}`;

          if (existingResult.rows.length === 0) {
            // Create new assignment
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

            // Audit log
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
                JSON.stringify(day),
                userId,
                'IMPORT',
                jobId
              ]
            );

            newAssignments++;
          } else {
            // Update existing assignment
            const existing = existingResult.rows[0];
            
            // Check if changed
            const hasChanged = 
              existing.shift_type !== day.shiftType ||
              existing.shift_start_time !== day.shiftStartTime ||
              existing.shift_end_time !== day.shiftEndTime;

            if (hasChanged) {
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

              // Audit log
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
                    shiftStartTime: existing.shift_start_time,
                    shiftEndTime: existing.shift_end_time
                  }),
                  JSON.stringify(day),
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
          console.error(`Error processing assignment for ${mapping.roster_employee_name} on ${day.date}:`, err);
          errors.push(`${mapping.roster_employee_name} - ${day.date}: ${err.message}`);
        }
      }
    }

    // Update job status
    await client.query(
      `UPDATE roster_import_jobs
       SET status = $1,
           new_assignments = $2,
           updated_assignments = $3,
           unchanged_assignments = $4,
           invalid_entries = $5,
           error_summary = $6,
           confirmed_at = NOW(),
           confirmed_by = $7
       WHERE id = $8`,
      [
        errors.length > 0 ? 'PARTIAL' : 'CONFIRMED',
        newAssignments,
        updatedAssignments,
        unchangedAssignments,
        errors.length,
        JSON.stringify(errors),
        userId,
        jobId
      ]
    );

    await client.query('COMMIT');

    return sendSuccess(res, 'Roster import confirmed and applied successfully.', {
      jobId,
      newAssignments,
      updatedAssignments,
      unchangedAssignments,
      totalProcessed: newAssignments + updatedAssignments + unchangedAssignments,
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
    const offset = (page - 1) * limit;

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
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(countResult.rows[0].count / limit)
      }
    });

  } catch (err) {
    console.error('Import history error:', err);
    return sendError(res, 'Failed to retrieve import history.', 500);
  }
};

/**
 * GET /api/v1/roster/assignments
 * Get shift assignments for date range or month
 */
export const getAssignments = async (req, res, next) => {
  try {
    const orgId = req.user?.orgId || req.user?.org?.id;
    const { employeeId, startDate, endDate, month, year } = req.query;

    let query = `
      SELECT 
        sa.*,
        e.employee_code,
        e.first_name,
        e.last_name,
        d.title as designation_title
      FROM shift_assignments sa
      JOIN employees e ON sa.employee_id = e.id
      LEFT JOIN designations d ON e.desig_id = d.id
      WHERE sa.org_id = $1
    `;
    const params = [orgId];

    if (employeeId) {
      params.push(employeeId);
      query += ` AND sa.employee_id = $${params.length}`;
    }

    if (month && year) {
      const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const lastDayStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      
      params.push(firstDay, lastDayStr);
      query += ` AND sa.assignment_date BETWEEN $${params.length - 1} AND $${params.length}`;
    } else if (startDate && endDate) {
      params.push(startDate, endDate);
      query += ` AND sa.assignment_date BETWEEN $${params.length - 1} AND $${params.length}`;
    }

    query += ` ORDER BY sa.assignment_date, e.last_name, e.first_name`;

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
