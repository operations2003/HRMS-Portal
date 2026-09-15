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
        acknowledgement_log, is_encrypted, encryption_metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16,
        $17, $18, $19
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
};

