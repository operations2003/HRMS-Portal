import { query } from '../config/db.js';

export const mapDocumentRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.org_id,
    ownerType: row.owner_type,
    ownerId: row.owner_id,
    category: row.category,
    documentType: row.document_type,
    title: row.title,
    version: row.version,
    fileUrl: row.file_url,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    verificationStatus: row.verification_status,
    verifiedBy: row.verified_by || null,
    verifiedByName: row.u_name || null,
    verifiedAt: row.verified_at ? new Date(row.verified_at).toISOString() : null,
    rejectionReason: row.rejection_reason || '',
    expiryDate: row.expiry_date ? (row.expiry_date.toISOString ? row.expiry_date.toISOString().split('T')[0] : row.expiry_date) : null,
    acknowledgementLog: typeof row.acknowledgement_log === 'string' ? JSON.parse(row.acknowledgement_log) : (row.acknowledgement_log || []),
    isEncrypted: Boolean(row.is_encrypted),
    encryptionMetadata: typeof row.encryption_metadata === 'string' ? JSON.parse(row.encryption_metadata) : (row.encryption_metadata || {}),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  };
};

const BASE_DOC_SELECT = `
  SELECT 
    d.id,
    d.org_id,
    d.owner_type,
    d.owner_id,
    d.category,
    d.document_type,
    d.title,
    d.version,
    d.file_url,
    d.file_size,
    d.mime_type,
    d.verification_status,
    d.verified_by,
    d.verified_at,
    d.rejection_reason,
    d.expiry_date,
    d.acknowledgement_log,
    d.is_encrypted,
    d.encryption_metadata,
    d.created_at,
    d.updated_at,
    CONCAT(u.first_name, ' ', u.last_name) AS u_name
  FROM document_vault d
  LEFT JOIN users u ON u.id = d.verified_by
`;

export const documentRepository = {
  /**
   * Find document by ID
   */
  async findById(id) {
    const text = `${BASE_DOC_SELECT} WHERE d.id = $1;`;
    const res = await query(text, [id]);
    return res.rows.length > 0 ? mapDocumentRow(res.rows[0]) : null;
  },

  /**
   * Find documents for an owner (candidate / new hire / employee)
   */
  async findByOwner(ownerType, ownerId) {
    const text = `
      ${BASE_DOC_SELECT}
      WHERE d.owner_type = $1 AND d.owner_id = $2
      ORDER BY d.category ASC, d.version DESC, d.created_at DESC;
    `;
    const res = await query(text, [ownerType, ownerId]);
    return res.rows.map((row) => mapDocumentRow(row));
  },

  /**
   * Insert new document metadata into Document Vault
   */
  async create(data) {
    const id = data.id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const text = `
      INSERT INTO document_vault (
        id, org_id, owner_type, owner_id, category, document_type,
        title, version, file_url, file_size, mime_type, verification_status,
        verified_by, verified_at, rejection_reason, expiry_date,
        acknowledgement_log, is_encrypted, encryption_metadata, file_data
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16,
        $17, $18, $19, $20
      )
      RETURNING id;
    `;

    const values = [
      id,
      data.orgId,
      data.ownerType || 'NEW_HIRE',
      data.ownerId,
      (data.category || 'OTHER').toUpperCase(),
      (data.documentType || 'OTHER').toUpperCase(),
      data.title,
      data.version || 1,
      data.fileUrl,
      data.fileSize || 0,
      data.mimeType || 'application/pdf',
      data.verificationStatus || 'PENDING',
      data.verifiedBy || null,
      data.verifiedAt || null,
      data.rejectionReason || '',
      data.expiryDate || null,
      JSON.stringify(data.acknowledgementLog || []),
      Boolean(data.isEncrypted),
      JSON.stringify(data.encryptionMetadata || {}),
      data.fileData || null,
    ];

    await query(text, values);
    return this.findById(id);
  },

  /**
   * Update document verification status (e.g. APPROVED, REJECTED)
   */
  async updateVerification(id, { verificationStatus, verifiedBy, rejectionReason }) {
    const text = `
      UPDATE document_vault
      SET 
        verification_status = $1,
        verified_by = $2,
        verified_at = NOW(),
        rejection_reason = $3,
        updated_at = NOW()
      WHERE id = $4
      RETURNING id;
    `;
    const res = await query(text, [verificationStatus, verifiedBy || null, rejectionReason || '', id]);
    if (res.rowCount === 0) return null;
    return this.findById(id);
  },

  /**
   * Append acknowledgement to the immutable log
   */
  async appendAcknowledgement(id, { acknowledgedBy, ipAddress = '', userAgent = '' }) {
    const ackEntry = {
      acknowledgedBy,
      timestamp: new Date().toISOString(),
      ipAddress,
      userAgent,
    };

    const text = `
      UPDATE document_vault
      SET 
        acknowledgement_log = acknowledgement_log || $1::jsonb,
        updated_at = NOW()
      WHERE id = $2
      RETURNING id;
    `;
    const res = await query(text, [JSON.stringify([ackEntry]), id]);
    if (res.rowCount === 0) return null;
    return this.findById(id);
  },

  /**
   * Create a new version of an existing document
   */
  async createNewVersion(existingId, newVersionData) {
    const existing = await this.findById(existingId);
    if (!existing) {
      throw new Error(`Document ${existingId} not found`);
    }

    const nextVersion = (existing.version || 1) + 1;
    return this.create({
      ...existing,
      ...newVersionData,
      id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      version: nextVersion,
      verificationStatus: 'PENDING',
      verifiedBy: null,
      verifiedAt: null,
      rejectionReason: '',
    });
  },

  /**
   * Delete a document
   */
  async delete(id) {
    const text = 'DELETE FROM document_vault WHERE id = $1 RETURNING id;';
    const res = await query(text, [id]);
    return res.rowCount > 0;
  },

  /**
   * Fetch binary file data directly from the database for secure download / preview
   */
  async getFileData(id) {
    const text = `
      SELECT id, title, file_url, mime_type, file_size, file_data 
      FROM document_vault 
      WHERE id = $1;
    `;
    const res = await query(text, [id]);
    return res.rows[0] || null;
  },

  /**
   * Find all documents across the organization with owner and verification metadata
   */
  async findAll({
    orgId,
    ownerType,
    ownerId,
    category,
    verificationStatus,
    search,
    managerEmployeeId,
    limit = 100,
    offset = 0,
  } = {}) {
    let whereClauses = [];
    let params = [];
    let idx = 1;

    if (orgId) {
      whereClauses.push(`d.org_id = $${idx++}`);
      params.push(orgId);
    }
    if (ownerType) {
      whereClauses.push(`d.owner_type = $${idx++}`);
      params.push(ownerType.toUpperCase());
    }
    if (ownerId) {
      whereClauses.push(`d.owner_id = $${idx++}`);
      params.push(ownerId);
    }
    if (category && category !== 'ALL') {
      whereClauses.push(`d.category = $${idx++}`);
      params.push(category.toUpperCase());
    }
    if (verificationStatus && verificationStatus !== 'ALL') {
      whereClauses.push(`d.verification_status = $${idx++}`);
      params.push(verificationStatus.toUpperCase());
    }
    if (search && search.trim()) {
      whereClauses.push(`(
        d.title ILIKE $${idx} OR 
        d.document_type ILIKE $${idx} OR 
        e.first_name ILIKE $${idx} OR 
        e.last_name ILIKE $${idx} OR 
        e.email ILIKE $${idx} OR
        e.employee_code ILIKE $${idx} OR
        nh.first_name ILIKE $${idx} OR
        nh.last_name ILIKE $${idx} OR
        nh.email ILIKE $${idx}
      )`);
      params.push(`%${search.trim()}%`);
      idx++;
    }
    if (managerEmployeeId) {
      whereClauses.push(`e.manager_id = $${idx++}`);
      params.push(managerEmployeeId);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const text = `
      SELECT 
        d.id,
        d.org_id,
        d.owner_type,
        d.owner_id,
        d.category,
        d.document_type,
        d.title,
        d.version,
        d.file_url,
        d.file_size,
        d.mime_type,
        d.verification_status,
        d.verified_by,
        d.verified_at,
        d.rejection_reason,
        d.expiry_date,
        d.acknowledgement_log,
        d.is_encrypted,
        d.encryption_metadata,
        d.created_at,
        d.updated_at,
        CONCAT(u.first_name, ' ', u.last_name) AS u_name,
        COALESCE(NULLIF(TRIM(CONCAT(e.first_name, ' ', e.last_name)), ''), NULLIF(TRIM(CONCAT(nh.first_name, ' ', nh.last_name)), ''), 'Unknown Owner') AS owner_name,
        COALESCE(e.email, nh.email, '') AS owner_email,
        COALESCE(e.employee_code, '') AS owner_code,
        COALESCE(dep.name, nh.location, '') AS owner_department
      FROM document_vault d
      LEFT JOIN users u ON u.id = d.verified_by
      LEFT JOIN employees e ON (d.owner_type = 'EMPLOYEE' AND e.id = d.owner_id)
      LEFT JOIN departments dep ON dep.id = e.dept_id
      LEFT JOIN new_hires nh ON (d.owner_type = 'NEW_HIRE' AND nh.id = d.owner_id)
      ${whereSql}
      ORDER BY d.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++};
    `;

    params.push(limit, offset);
    const res = await query(text, params);
    return res.rows.map((row) => {
      const mapped = mapDocumentRow(row);
      mapped.ownerName = row.owner_name;
      mapped.ownerEmail = row.owner_email;
      mapped.ownerCode = row.owner_code;
      mapped.ownerDepartment = row.owner_department;
      return mapped;
    });
  },
};

