import { pool, query } from '../config/db.js';
import { maskNationalId, decryptField } from '../utils/cryptoUtils.js';

/**
 * Format joined new hire row into API response format
 */
export const mapNewHireRow = (row, includeDecrypted = false) => {
  if (!row) return null;

  let nationalIdPlain = null;
  if (row.national_id_number) {
    nationalIdPlain = decryptField(row.national_id_number);
  }

  const tracker =
    typeof row.readiness_tracker === 'string'
      ? JSON.parse(row.readiness_tracker)
      : row.readiness_tracker || {};

  const itSetup = tracker.it_setup || {
    workEmail: '',
    emailProvisioned: tracker.itSetup || false,
    systemAccess: ['HRMS'],
    accounts: {},
    hardwareAssigned: tracker.workstationReady || false,
    laptopModel: '',
    assetTag: '',
    status: tracker.itSetup ? 'COMPLETED' : 'PENDING',
    notes: '',
    updatedAt: null,
    updatedBy: null,
  };

  return {
    id: row.id,
    orgId: row.org_id,
    atsCandidateId: row.ats_candidate_id,
    atsJobId: row.ats_job_id || '',
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: `${row.first_name} ${row.last_name}`.trim(),
    email: row.email,
    phone: row.phone || '',
    dateOfJoining: row.date_of_joining
      ? row.date_of_joining.toISOString
        ? row.date_of_joining.toISOString().split('T')[0]
        : String(row.date_of_joining).split('T')[0]
      : '',
    deptId: row.dept_id || null,
    desigId: row.desig_id || null,
    managerId: row.manager_id || null,
    location: row.location || '',
    lifecycleState: row.lifecycle_state,
    onboardingStatus: row.onboarding_status,
    bgvStatus: row.bgv_status,
    readinessTracker: tracker,
    itSetup,
    nationalIdType: row.national_id_type || 'PAN',
    nationalIdMasked: nationalIdPlain ? maskNationalId(nationalIdPlain) : '',
    nationalId: includeDecrypted ? nationalIdPlain : undefined,
    employeeId: row.employee_id || null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    organization: row.o_id ? { id: row.o_id, name: row.o_name, code: row.o_code } : null,
    department: row.d_id ? { id: row.d_id, name: row.d_name, code: row.d_code } : null,
    designation: row.ds_id ? { id: row.ds_id, title: row.ds_title, code: row.ds_code } : null,
    manager: row.m_id
      ? { id: row.m_id, name: `${row.m_first_name} ${row.m_last_name}`.trim(), code: row.m_code }
      : null,
  };
};

const BASE_NEW_HIRE_SELECT = `
  SELECT 
    nh.id,
    nh.org_id,
    nh.ats_candidate_id,
    nh.ats_job_id,
    nh.first_name,
    nh.last_name,
    nh.email,
    nh.phone,
    nh.date_of_joining,
    nh.dept_id,
    nh.desig_id,
    nh.manager_id,
    nh.location,
    nh.lifecycle_state,
    nh.onboarding_status,
    nh.bgv_status,
    nh.readiness_tracker,
    nh.national_id_type,
    nh.national_id_number,
    nh.national_id_hash,
    nh.employee_id,
    nh.raw_ats_payload,
    nh.created_at,
    nh.updated_at,
    o.id AS o_id, o.name AS o_name, o.code AS o_code,
    d.id AS d_id, d.name AS d_name, d.code AS d_code,
    ds.id AS ds_id, ds.title AS ds_title, ds.code AS ds_code,
    m.id AS m_id, m.first_name AS m_first_name, m.last_name AS m_last_name, m.employee_code AS m_code
  FROM new_hires nh
  LEFT JOIN organizations o ON o.id = nh.org_id
  LEFT JOIN departments d ON d.id = nh.dept_id
  LEFT JOIN designations ds ON ds.id = nh.desig_id
  LEFT JOIN employees m ON m.id = nh.manager_id
`;

export const newHireRepository = {
  /**
   * Find new hire by primary key ID
   */
  async findById(id) {
    const text = `${BASE_NEW_HIRE_SELECT} WHERE nh.id = $1;`;
    const res = await query(text, [id]);
    return res.rows.length > 0 ? mapNewHireRow(res.rows[0]) : null;
  },

  /**
   * Find by ATS Candidate ID within an organization
   */
  async findByAtsId(orgId, atsCandidateId) {
    const text = `${BASE_NEW_HIRE_SELECT} WHERE nh.org_id = $1 AND nh.ats_candidate_id = $2;`;
    const res = await query(text, [orgId, atsCandidateId]);
    return res.rows.length > 0 ? mapNewHireRow(res.rows[0]) : null;
  },

  /**
   * Find by Email within an organization
   */
  async findByEmail(orgId, email) {
    const text = `${BASE_NEW_HIRE_SELECT} WHERE nh.org_id = $1 AND LOWER(nh.email) = LOWER($2);`;
    const res = await query(text, [orgId, email]);
    return res.rows.length > 0 ? mapNewHireRow(res.rows[0]) : null;
  },

  /**
   * Find by National ID Hash within an organization
   */
  async findByNationalIdHash(orgId, nationalIdHash) {
    if (!nationalIdHash) return null;
    const text = `${BASE_NEW_HIRE_SELECT} WHERE nh.org_id = $1 AND nh.national_id_hash = $2;`;
    const res = await query(text, [orgId, nationalIdHash]);
    return res.rows.length > 0 ? mapNewHireRow(res.rows[0]) : null;
  },

  /**
   * Insert new hire record
   */
  async create(data) {
    const id = data.id || `nh_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const text = `
      INSERT INTO new_hires (
        id, org_id, ats_candidate_id, ats_job_id, first_name, last_name, email,
        phone, date_of_joining, dept_id, desig_id, manager_id, location,
        lifecycle_state, onboarding_status, bgv_status, readiness_tracker,
        national_id_type, national_id_number, national_id_hash, raw_ats_payload
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17,
        $18, $19, $20, $21
      )
      RETURNING id;
    `;

    const readiness = data.readinessTracker || {
      itSetup: false,
      workstationReady: false,
      welcomeKitDispatched: false,
      idCardGenerated: false,
      orientationScheduled: false,
      completionPercentage: 0,
      it_setup: {
        workEmail: '',
        emailProvisioned: false,
        systemAccess: ['HRMS'],
        accounts: {},
        hardwareAssigned: false,
        laptopModel: '',
        assetTag: '',
        status: 'PENDING',
        notes: '',
        updatedAt: new Date().toISOString(),
        updatedBy: 'ATS_Handoff',
      },
    };

    const values = [
      id,
      data.orgId,
      data.atsCandidateId,
      data.atsJobId || '',
      data.firstName,
      data.lastName,
      data.email.toLowerCase().trim(),
      data.phone || '',
      data.dateOfJoining,
      data.deptId || null,
      data.desigId || null,
      data.managerId || null,
      data.location || '',
      data.lifecycleState || 'NEW_HIRE',
      data.onboardingStatus || 'NOT_STARTED',
      data.bgvStatus || 'PENDING',
      JSON.stringify(readiness),
      data.nationalIdType || 'PAN',
      data.nationalIdNumber || null,
      data.nationalIdHash || null,
      JSON.stringify(data.rawAtsPayload || {}),
    ];

    await query(text, values);
    return this.findById(id);
  },

  /**
   * Update lifecycle and onboarding state
   */
  async updateLifecycleState(id, { lifecycleState, onboardingStatus, bgvStatus }) {
    const updates = [];
    const values = [];
    let idx = 1;

    if (lifecycleState) {
      updates.push(`lifecycle_state = $${idx++}`);
      values.push(lifecycleState);
    }
    if (onboardingStatus) {
      updates.push(`onboarding_status = $${idx++}`);
      values.push(onboardingStatus);
    }
    if (bgvStatus) {
      updates.push(`bgv_status = $${idx++}`);
      values.push(bgvStatus);
    }

    if (updates.length === 0) return this.findById(id);

    values.push(id);
    const sql = `UPDATE new_hires SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING id;`;
    await query(sql, values);
    return this.findById(id);
  },

  /**
   * Update readiness tracker JSON checklist
   */
  async updateReadinessTracker(id, checklist) {
    const text = `
      UPDATE new_hires 
      SET readiness_tracker = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id;
    `;
    await query(text, [JSON.stringify(checklist), id]);
    return this.findById(id);
  },

  /**
   * Update individual checklist items and recalculate completion percentage
   */
  async updateChecklist(id, updates = {}) {
    const existing = await this.findById(id);
    if (!existing) return null;

    const tracker = existing.readinessTracker || {};
    const merged = { ...tracker };

    const CHECKLIST_KEYS = [
      'itSetup',
      'workstationReady',
      'welcomeKitDispatched',
      'idCardGenerated',
      'orientationScheduled',
    ];

    for (const [key, val] of Object.entries(updates)) {
      if (typeof val === 'boolean') {
        merged[key] = val;
      }
    }

    // Recalculate completion percentage
    const completedCount = CHECKLIST_KEYS.filter((k) => merged[k] === true).length;
    merged.completionPercentage = Math.round((completedCount / CHECKLIST_KEYS.length) * 100);

    // Synchronize onboarding status if completed
    let newStatus = existing.onboardingStatus;
    if (merged.completionPercentage === 100 && (existing.onboardingStatus === 'IN_PROGRESS' || existing.onboardingStatus === 'NOT_STARTED')) {
      newStatus = 'READY_FOR_JOINING';
    }

    await query(
      'UPDATE new_hires SET readiness_tracker = $1, onboarding_status = $2, updated_at = NOW() WHERE id = $3;',
      [JSON.stringify(merged), newStatus, id]
    );

    return this.findById(id);
  },

  /**
   * Get IT setup status and configuration
   */
  async getItSetup(id) {
    const existing = await this.findById(id);
    if (!existing) return null;
    return existing.itSetup;
  },

  /**
   * Update IT setup provisioning status
   */
  async updateItSetup(id, itData = {}, updatedBy = 'IT Admin') {
    const existing = await this.findById(id);
    if (!existing) return null;

    const tracker = existing.readinessTracker || {};
    const currentIt = tracker.it_setup || {};

    const updatedIt = {
      ...currentIt,
      ...itData,
      updatedAt: new Date().toISOString(),
      updatedBy: updatedBy || currentIt.updatedBy || 'IT Admin',
    };

    // Auto-sync itSetup and workstationReady flags
    if (updatedIt.status === 'COMPLETED' || updatedIt.emailProvisioned) {
      tracker.itSetup = true;
    }
    if (updatedIt.hardwareAssigned) {
      tracker.workstationReady = true;
    }

    tracker.it_setup = updatedIt;

    // Recalculate completion percentage
    const CHECKLIST_KEYS = [
      'itSetup',
      'workstationReady',
      'welcomeKitDispatched',
      'idCardGenerated',
      'orientationScheduled',
    ];
    const completedCount = CHECKLIST_KEYS.filter((k) => tracker[k] === true).length;
    tracker.completionPercentage = Math.round((completedCount / CHECKLIST_KEYS.length) * 100);

    let newStatus = existing.onboardingStatus;
    if (tracker.completionPercentage === 100 && (existing.onboardingStatus === 'IN_PROGRESS' || existing.onboardingStatus === 'NOT_STARTED')) {
      newStatus = 'READY_FOR_JOINING';
    }

    await query(
      'UPDATE new_hires SET readiness_tracker = $1, onboarding_status = $2, updated_at = NOW() WHERE id = $3;',
      [JSON.stringify(tracker), newStatus, id]
    );

    const updated = await this.findById(id);
    return updated ? updated.itSetup : null;
  },

  /**
   * Convert Onboarding New Hire to Active Employee within an atomic transaction
   * Links to existing employee if found by email, avoiding duplicate profiles in Employee Master
   */
  async convertToEmployee(newHireId, employeeData = {}) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Fetch current new_hire record inside transaction with row lock
      const nhRes = await client.query('SELECT * FROM new_hires WHERE id = $1 FOR UPDATE;', [newHireId]);
      if (nhRes.rows.length === 0) {
        throw new Error(`New hire record ${newHireId} not found`);
      }
      const nh = nhRes.rows[0];

      if (nh.lifecycle_state === 'CONVERTED_TO_EMPLOYEE' && nh.employee_id) {
        throw new Error(`Candidate is already converted to employee (Employee ID: ${nh.employee_id})`);
      }

      // 2. Check if an active employee profile with this candidate's email already exists in this organization
      const existingEmpRes = await client.query(
        'SELECT * FROM employees WHERE org_id = $1 AND LOWER(email) = LOWER($2);',
        [nh.org_id, nh.email]
      );

      let empId;
      let employeeCode;
      let employeeRecord;
      let isExistingProfileLinked = false;

      if (existingEmpRes.rows.length > 0) {
        // Link to existing employee profile without creating a duplicate record
        employeeRecord = existingEmpRes.rows[0];
        empId = employeeRecord.id;
        employeeCode = employeeRecord.employee_code;
        isExistingProfileLinked = true;
      } else {
        // Generate unique employee code if not provided
        employeeCode = employeeData.employeeCode;
        if (!employeeCode) {
          const countRes = await client.query('SELECT COUNT(*)::int AS count FROM employees WHERE org_id = $1;', [
            nh.org_id,
          ]);
          const seq = (countRes.rows[0].count + 1).toString().padStart(4, '0');
          const year = new Date().getFullYear();
          employeeCode = `EMP-${year}-${seq}`;
        }

        // Ensure unique code
        const codeCheck = await client.query(
          'SELECT id FROM employees WHERE org_id = $1 AND employee_code = $2;',
          [nh.org_id, employeeCode]
        );
        if (codeCheck.rows.length > 0) {
          employeeCode = `EMP-${Date.now().toString().slice(-6)}`;
        }

        // Create new employee record in employees table
        empId = `emp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const empSql = `
          INSERT INTO employees (
            id, org_id, dept_id, desig_id, employee_code, first_name, last_name,
            email, phone, date_of_joining, employment_type, status, salary
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12, $13
          ) RETURNING *;
        `;

        const empValues = [
          empId,
          nh.org_id,
          employeeData.deptId || nh.dept_id,
          employeeData.desigId || nh.desig_id,
          employeeCode,
          nh.first_name,
          nh.last_name,
          nh.email,
          nh.phone || '',
          employeeData.dateOfJoining || nh.date_of_joining,
          employeeData.employmentType || 'Full-Time',
          'Active',
          employeeData.salary || 0.0,
        ];

        const empInsertRes = await client.query(empSql, empValues);
        employeeRecord = empInsertRes.rows[0];
      }

      // 3. Update new_hires table state to CONVERTED_TO_EMPLOYEE and link employee_id
      const nhUpdateSql = `
        UPDATE new_hires
        SET 
          lifecycle_state = 'CONVERTED_TO_EMPLOYEE',
          onboarding_status = 'COMPLETED',
          employee_id = $1,
          updated_at = NOW()
        WHERE id = $2;
      `;
      await client.query(nhUpdateSql, [empId, newHireId]);

      // 4. If documents exist under owner_type='NEW_HIRE', link to employee profile
      await client.query(
        `
        UPDATE document_vault
        SET owner_type = 'EMPLOYEE', owner_id = $1, updated_at = NOW()
        WHERE owner_type = 'NEW_HIRE' AND owner_id = $2;
      `,
        [empId, newHireId]
      );

      await client.query('COMMIT');

      return {
        success: true,
        isExistingProfileLinked,
        employeeId: empId,
        employeeCode: employeeCode,
        employee: employeeRecord,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Search / filter new hires with pagination
   */
  async findAll({
    orgId,
    status,
    lifecycleState,
    onboardingStatus,
    bgvStatus,
    joiningDate,
    dateOfJoining,
    joiningDateFrom,
    joiningDateTo,
    deptId,
    department,
    search,
    page = 1,
    limit = 20,
  } = {}) {
    const conditions = [];
    const values = [];
    let idx = 1;

    if (orgId) {
      conditions.push(`nh.org_id = $${idx++}`);
      values.push(orgId);
    }
    if (lifecycleState) {
      conditions.push(`nh.lifecycle_state = $${idx++}`);
      values.push(lifecycleState);
    }
    if (onboardingStatus) {
      conditions.push(`nh.onboarding_status = $${idx++}`);
      values.push(onboardingStatus);
    } else if (status) {
      conditions.push(`(nh.onboarding_status = $${idx} OR nh.lifecycle_state = $${idx})`);
      values.push(status);
      idx++;
    }
    if (bgvStatus) {
      conditions.push(`nh.bgv_status = $${idx++}`);
      values.push(bgvStatus);
    }

    const jd = joiningDate || dateOfJoining;
    if (jd) {
      conditions.push(`nh.date_of_joining = $${idx++}`);
      values.push(jd);
    }
    if (joiningDateFrom) {
      conditions.push(`nh.date_of_joining >= $${idx++}`);
      values.push(joiningDateFrom);
    }
    if (joiningDateTo) {
      conditions.push(`nh.date_of_joining <= $${idx++}`);
      values.push(joiningDateTo);
    }

    if (deptId) {
      conditions.push(`nh.dept_id = $${idx++}`);
      values.push(deptId);
    } else if (department) {
      conditions.push(`(d.name ILIKE $${idx} OR d.code ILIKE $${idx})`);
      values.push(`%${department}%`);
      idx++;
    }

    if (search) {
      conditions.push(`(
        nh.first_name ILIKE $${idx} OR
        nh.last_name ILIKE $${idx} OR
        nh.email ILIKE $${idx} OR
        nh.ats_candidate_id ILIKE $${idx}
      )`);
      values.push(`%${search}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*)::int AS total 
      FROM new_hires nh 
      LEFT JOIN departments d ON d.id = nh.dept_id
      ${whereClause};
    `;
    const countRes = await query(countSql, values);
    const total = countRes.rows[0]?.total || 0;

    const offset = (page - 1) * limit;
    const dataSql = `
      ${BASE_NEW_HIRE_SELECT}
      ${whereClause}
      ORDER BY nh.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    values.push(limit, offset);

    const dataRes = await query(dataSql, values);
    const items = dataRes.rows.map((row) => mapNewHireRow(row));

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  },
};
