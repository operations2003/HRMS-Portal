import { query } from '../config/db.js';
import { newHireRepository } from '../repositories/newHireRepository.js';
import { encryptField, hashDeterministic } from '../utils/cryptoUtils.js';

export const atsIntegrationService = {
  /**
   * Idempotent Duplicate Detection Engine
   * Validates incoming candidate against both new_hires and employees tables.
   *
   * @param {Object} payload
   * @returns {Promise<{ isDuplicate: boolean, isIdempotent: boolean, conflictReason?: string, record?: Object }>}
   */
  async checkDuplicates({ orgId, atsCandidateId, email, nationalId }) {
    const normalizedEmail = (email || '').toLowerCase().trim();
    const nationalIdHash = nationalId ? hashDeterministic(nationalId) : null;

    // 1. Check for exact ATS Candidate ID retry (Idempotency check)
    const existingByAts = await newHireRepository.findByAtsId(orgId, atsCandidateId);
    if (existingByAts) {
      return {
        isDuplicate: true,
        isIdempotent: true,
        record: existingByAts,
      };
    }

    // 2. Check if email already belongs to an existing Employee
    const empEmailRes = await query(
      'SELECT id, employee_code, first_name, last_name, email FROM employees WHERE org_id = $1 AND LOWER(email) = LOWER($2);',
      [orgId, normalizedEmail]
    );
    if (empEmailRes.rows.length > 0) {
      const emp = empEmailRes.rows[0];
      return {
        isDuplicate: true,
        isIdempotent: false,
        conflictReason: `Candidate email '${email}' is already registered to active Employee ${emp.employee_code} (${emp.first_name} ${emp.last_name}).`,
        existingType: 'EMPLOYEE',
        existingId: emp.id,
      };
    }

    // 3. Check if email already belongs to another New Hire
    const nhEmail = await newHireRepository.findByEmail(orgId, normalizedEmail);
    if (nhEmail) {
      return {
        isDuplicate: true,
        isIdempotent: false,
        conflictReason: `Candidate email '${email}' is already associated with New Hire (ATS ID: ${nhEmail.atsCandidateId}).`,
        existingType: 'NEW_HIRE',
        existingId: nhEmail.id,
      };
    }

    // 4. Check if National ID / Tax ID hash matches an existing New Hire
    if (nationalIdHash) {
      const nhNatId = await newHireRepository.findByNationalIdHash(orgId, nationalIdHash);
      if (nhNatId) {
        return {
          isDuplicate: true,
          isIdempotent: false,
          conflictReason: `National ID/Tax identifier is already associated with New Hire (ATS ID: ${nhNatId.atsCandidateId}).`,
          existingType: 'NEW_HIRE',
          existingId: nhNatId.id,
        };
      }
    }

    return {
      isDuplicate: false,
      isIdempotent: false,
    };
  },

  /**
   * Core Handoff Data Handler receiving candidate payload from ATS (Portal 2)
   *
   * @param {Object} rawPayload
   * @returns {Promise<{ status: string, code: number, message: string, record: Object, isIdempotent: boolean }>}
   */
  async processHandoff(rawPayload) {
    const {
      atsCandidateId,
      atsJobId = '',
      orgId,
      firstName,
      lastName,
      email,
      phone = '',
      dateOfJoining,
      deptId,
      departmentName,
      desigId,
      designationTitle,
      managerId,
      location = '',
      nationalIdType = 'PAN',
      nationalId = '',
    } = rawPayload;

    // 1. Verify Organization exists
    const orgRes = await query('SELECT id, name, status FROM organizations WHERE id = $1;', [orgId]);
    if (orgRes.rows.length === 0) {
      const err = new Error(`Organization with ID '${orgId}' does not exist.`);
      err.statusCode = 404;
      throw err;
    }
    if (orgRes.rows[0].status !== 'Active') {
      const err = new Error(`Organization '${orgRes.rows[0].name}' is currently inactive.`);
      err.statusCode = 400;
      throw err;
    }

    // 2. Resolve Department if departmentName provided without deptId
    let resolvedDeptId = deptId || null;
    if (!resolvedDeptId && departmentName) {
      const deptRes = await query(
        'SELECT id FROM departments WHERE org_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1;',
        [orgId, departmentName.trim()]
      );
      if (deptRes.rows.length > 0) {
        resolvedDeptId = deptRes.rows[0].id;
      }
    }

    // 3. Resolve Designation if designationTitle provided without desigId
    let resolvedDesigId = desigId || null;
    if (!resolvedDesigId && designationTitle) {
      const desigRes = await query(
        'SELECT id FROM designations WHERE org_id = $1 AND LOWER(title) = LOWER($2) LIMIT 1;',
        [orgId, designationTitle.trim()]
      );
      if (desigRes.rows.length > 0) {
        resolvedDesigId = desigRes.rows[0].id;
      }
    }

    // 4. Resolve Manager if managerId provided
    let resolvedManagerId = managerId || null;
    if (resolvedManagerId) {
      const mgrRes = await query('SELECT id FROM employees WHERE org_id = $1 AND id = $2;', [orgId, resolvedManagerId]);
      if (mgrRes.rows.length === 0) {
        resolvedManagerId = null; // Don't block handoff if manager ID doesn't exist, keep null
      }
    }

    // 5. Run Idempotent Duplicate Detection Engine
    const duplicateCheck = await this.checkDuplicates({
      orgId,
      atsCandidateId,
      email,
      nationalId,
    });

    // Case A: Idempotent Retry (Candidate already handed off)
    if (duplicateCheck.isDuplicate && duplicateCheck.isIdempotent) {
      return {
        status: 'SUCCESS_IDEMPOTENT',
        code: 200,
        message: `ATS candidate ${atsCandidateId} was already handed off. Returning existing record without duplication.`,
        isIdempotent: true,
        record: duplicateCheck.record,
      };
    }

    // Case B: Conflict with existing employee or different candidate
    if (duplicateCheck.isDuplicate && !duplicateCheck.isIdempotent) {
      const err = new Error(duplicateCheck.conflictReason);
      err.statusCode = 409;
      err.code = 'DUPLICATE_CONFLICT';
      err.details = {
        existingType: duplicateCheck.existingType,
        existingId: duplicateCheck.existingId,
      };
      throw err;
    }

    // Case C: New Record -> Field Encryption & Persistence
    let encryptedNationalId = null;
    let nationalIdHash = null;

    if (nationalId) {
      const enc = encryptField(nationalId.trim());
      if (enc) {
        encryptedNationalId = enc.rawEncrypted;
        nationalIdHash = hashDeterministic(nationalId);
      }
    }

    const newHireRecord = await newHireRepository.create({
      orgId,
      atsCandidateId,
      atsJobId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      dateOfJoining,
      deptId: resolvedDeptId,
      desigId: resolvedDesigId,
      managerId: resolvedManagerId,
      location: location.trim(),
      lifecycleState: 'NEW_HIRE',
      onboardingStatus: 'NOT_STARTED',
      bgvStatus: 'PENDING',
      nationalIdType,
      nationalIdNumber: encryptedNationalId,
      nationalIdHash,
      rawAtsPayload: rawPayload,
    });

    return {
      status: 'CREATED',
      code: 201,
      message: `Candidate ${firstName} ${lastName} successfully handed off to HRMS Onboarding.`,
      isIdempotent: false,
      record: newHireRecord,
    };
  },

  /**
   * Query status of an ATS candidate by ATS Candidate ID
   */
  async getAtsCandidateStatus(orgId, atsCandidateId) {
    const record = await newHireRepository.findByAtsId(orgId, atsCandidateId);
    if (!record) {
      const err = new Error(`ATS Candidate '${atsCandidateId}' not found in HRMS.`);
      err.statusCode = 404;
      throw err;
    }
    return record;
  },
};

