import { pool } from '../config/db.js';

/**
 * Format raw database row to sanitized AppSumo License domain object
 */
const mapLicenseRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    licenseKey: row.license_key,
    prevLicenseKey: row.prev_license_key || null,
    organizationId: row.organization_id || null,
    organizationName: row.org_name || null,
    organizationCode: row.org_code || null,
    activatedByUserId: row.activated_by_user_id || null,
    activatedByUserEmail: row.user_email || null,
    tier: parseInt(row.tier, 10) || 1,
    status: row.status, // 'active', 'inactive', 'deactivated'
    event: row.event,
    partnerPlanName: row.partner_plan_name,
    unitQuantity: parseInt(row.unit_quantity, 10) || 1,
    parentLicenseKey: row.parent_license_key || null,
    isTest: Boolean(row.is_test),
    rawDetails: row.raw_details || {},
    lastEventAt: row.last_event_at ? new Date(row.last_event_at).toISOString() : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
};

const mapEventRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    licenseId: row.license_id,
    licenseKey: row.license_key,
    prevLicenseKey: row.prev_license_key,
    event: row.event,
    tier: row.tier,
    licenseStatus: row.license_status,
    eventTimestamp: row.event_timestamp ? Number(row.event_timestamp) : null,
    createdAtFromAppSumo: row.created_at_from_appsumo ? Number(row.created_at_from_appsumo) : null,
    test: Boolean(row.test),
    payload: row.payload || {},
    processed: Boolean(row.processed),
    processingError: row.processing_error || null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
  };
};

const BASE_LICENSE_SELECT = `
  SELECT 
    al.id,
    al.license_key,
    al.prev_license_key,
    al.organization_id,
    al.activated_by_user_id,
    al.tier,
    al.status,
    al.event,
    al.partner_plan_name,
    al.unit_quantity,
    al.parent_license_key,
    al.is_test,
    al.raw_details,
    al.last_event_at,
    al.created_at,
    al.updated_at,
    o.name AS org_name,
    o.code AS org_code,
    u.email AS user_email
  FROM appsumo_licenses al
  LEFT JOIN organizations o ON o.id = al.organization_id
  LEFT JOIN users u ON u.id = al.activated_by_user_id
`;

export const appsumoRepository = {
  /**
   * Find license by AppSumo license key
   */
  async findByLicenseKey(licenseKey, client = pool) {
    if (!licenseKey || typeof licenseKey !== 'string') return null;

    const sql = `
      ${BASE_LICENSE_SELECT}
      WHERE al.license_key = $1
      LIMIT 1;
    `;
    const res = await client.query(sql, [licenseKey.trim()]);
    return res.rows.length > 0 ? mapLicenseRow(res.rows[0]) : null;
  },

  /**
   * Find license by previous license key (used in upgrade/downgrade)
   */
  async findByPrevLicenseKey(prevLicenseKey, client = pool) {
    if (!prevLicenseKey || typeof prevLicenseKey !== 'string') return null;

    // First check if a license directly has this license_key
    const byKeySql = `
      ${BASE_LICENSE_SELECT}
      WHERE al.license_key = $1
      LIMIT 1;
    `;
    const resByKey = await client.query(byKeySql, [prevLicenseKey.trim()]);
    if (resByKey.rows.length > 0) {
      return mapLicenseRow(resByKey.rows[0]);
    }

    // Check if recorded in prev_license_key
    const byPrevSql = `
      ${BASE_LICENSE_SELECT}
      WHERE al.prev_license_key = $1
      ORDER BY al.created_at DESC
      LIMIT 1;
    `;
    const resByPrev = await client.query(byPrevSql, [prevLicenseKey.trim()]);
    return resByPrev.rows.length > 0 ? mapLicenseRow(resByPrev.rows[0]) : null;
  },

  /**
   * Find active AppSumo license for an organization
   */
  async findByOrganizationId(orgId, client = pool) {
    if (!orgId || typeof orgId !== 'string') return null;

    const sql = `
      ${BASE_LICENSE_SELECT}
      WHERE al.organization_id = $1
      ORDER BY 
        CASE WHEN al.status = 'active' THEN 1 ELSE 2 END,
        al.updated_at DESC
      LIMIT 1;
    `;
    const res = await client.query(sql, [orgId]);
    return res.rows.length > 0 ? mapLicenseRow(res.rows[0]) : null;
  },

  /**
   * Upsert an AppSumo license record
   */
  async upsertLicense(data, client = pool) {
    const id = data.id || `asl-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const licenseKey = data.licenseKey.trim();
    const prevLicenseKey = data.prevLicenseKey ? data.prevLicenseKey.trim() : null;
    const organizationId = data.organizationId || null;
    const activatedByUserId = data.activatedByUserId || null;
    const tier = parseInt(data.tier, 10) || 1;
    const status = data.status || 'inactive';
    const event = data.event || 'purchase';
    const partnerPlanName = data.partnerPlanName || 'TaskNera AppSumo Plan';
    const unitQuantity = parseInt(data.unitQuantity, 10) || 1;
    const parentLicenseKey = data.parentLicenseKey ? data.parentLicenseKey.trim() : null;
    const isTest = Boolean(data.isTest);
    const rawDetails = data.rawDetails || {};
    const lastEventAt = data.lastEventAt || new Date().toISOString();

    const sql = `
      INSERT INTO appsumo_licenses (
        id,
        license_key,
        prev_license_key,
        organization_id,
        activated_by_user_id,
        tier,
        status,
        event,
        partner_plan_name,
        unit_quantity,
        parent_license_key,
        is_test,
        raw_details,
        last_event_at,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
      ON CONFLICT (license_key) DO UPDATE SET
        prev_license_key = COALESCE(EXCLUDED.prev_license_key, appsumo_licenses.prev_license_key),
        organization_id = COALESCE(EXCLUDED.organization_id, appsumo_licenses.organization_id),
        activated_by_user_id = COALESCE(EXCLUDED.activated_by_user_id, appsumo_licenses.activated_by_user_id),
        tier = EXCLUDED.tier,
        status = EXCLUDED.status,
        event = EXCLUDED.event,
        partner_plan_name = EXCLUDED.partner_plan_name,
        unit_quantity = EXCLUDED.unit_quantity,
        parent_license_key = COALESCE(EXCLUDED.parent_license_key, appsumo_licenses.parent_license_key),
        is_test = EXCLUDED.is_test,
        raw_details = EXCLUDED.raw_details,
        last_event_at = EXCLUDED.last_event_at,
        updated_at = NOW()
      RETURNING *;
    `;

    const res = await client.query(sql, [
      id,
      licenseKey,
      prevLicenseKey,
      organizationId,
      activatedByUserId,
      tier,
      status,
      event,
      partnerPlanName,
      unitQuantity,
      parentLicenseKey,
      isTest,
      JSON.stringify(rawDetails),
      lastEventAt,
    ]);

    return this.findByLicenseKey(licenseKey, client);
  },

  /**
   * Update license fields directly
   */
  async updateLicense(licenseKey, updates, client = pool) {
    if (!licenseKey) return null;

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    if (updates.organizationId !== undefined) {
      setClauses.push(`organization_id = $${paramIndex++}`);
      values.push(updates.organizationId);
    }

    if (updates.activatedByUserId !== undefined) {
      setClauses.push(`activated_by_user_id = $${paramIndex++}`);
      values.push(updates.activatedByUserId);
    }

    if (updates.prevLicenseKey !== undefined) {
      setClauses.push(`prev_license_key = $${paramIndex++}`);
      values.push(updates.prevLicenseKey);
    }

    if (updates.tier !== undefined) {
      setClauses.push(`tier = $${paramIndex++}`);
      values.push(parseInt(updates.tier, 10) || 1);
    }

    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }

    if (updates.event !== undefined) {
      setClauses.push(`event = $${paramIndex++}`);
      values.push(updates.event);
    }

    if (updates.partnerPlanName !== undefined) {
      setClauses.push(`partner_plan_name = $${paramIndex++}`);
      values.push(updates.partnerPlanName);
    }

    if (updates.unitQuantity !== undefined) {
      setClauses.push(`unit_quantity = $${paramIndex++}`);
      values.push(parseInt(updates.unitQuantity, 10) || 1);
    }

    if (updates.parentLicenseKey !== undefined) {
      setClauses.push(`parent_license_key = $${paramIndex++}`);
      values.push(updates.parentLicenseKey);
    }

    if (updates.rawDetails !== undefined) {
      setClauses.push(`raw_details = $${paramIndex++}`);
      values.push(JSON.stringify(updates.rawDetails));
    }

    if (updates.lastEventAt !== undefined) {
      setClauses.push(`last_event_at = $${paramIndex++}`);
      values.push(updates.lastEventAt);
    }

    if (setClauses.length === 0) {
      return this.findByLicenseKey(licenseKey, client);
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(licenseKey);

    const sql = `
      UPDATE appsumo_licenses
      SET ${setClauses.join(', ')}
      WHERE license_key = $${paramIndex}
      RETURNING *;
    `;

    await client.query(sql, values);
    return this.findByLicenseKey(licenseKey, client);
  },

  /**
   * Record raw webhook event for audit, debugging, and idempotency
   */
  async recordEvent(eventData, client = pool) {
    const id = eventData.id || `ase-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const licenseId = eventData.licenseId || null;
    const licenseKey = eventData.licenseKey ? eventData.licenseKey.trim() : '';
    const prevLicenseKey = eventData.prevLicenseKey ? eventData.prevLicenseKey.trim() : null;
    const event = eventData.event || 'unknown';
    const tier = eventData.tier !== undefined ? parseInt(eventData.tier, 10) : null;
    const licenseStatus = eventData.licenseStatus || null;
    const eventTimestamp = eventData.eventTimestamp ? Number(eventData.eventTimestamp) : null;
    const createdAtFromAppSumo = eventData.createdAtFromAppSumo ? Number(eventData.createdAtFromAppSumo) : null;
    const test = Boolean(eventData.test);
    const payload = eventData.payload || {};
    const processed = eventData.processed !== undefined ? Boolean(eventData.processed) : true;
    const processingError = eventData.processingError || null;

    const sql = `
      INSERT INTO appsumo_license_events (
        id,
        license_id,
        license_key,
        prev_license_key,
        event,
        tier,
        license_status,
        event_timestamp,
        created_at_from_appsumo,
        test,
        payload,
        processed,
        processing_error,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      RETURNING *;
    `;

    const res = await client.query(sql, [
      id,
      licenseId,
      licenseKey,
      prevLicenseKey,
      event,
      tier,
      licenseStatus,
      eventTimestamp,
      createdAtFromAppSumo,
      test,
      JSON.stringify(payload),
      processed,
      processingError,
    ]);

    return mapEventRow(res.rows[0]);
  },

  /**
   * Check for duplicate/previously processed identical event (Idempotency)
   */
  async findDuplicateEvent({ licenseKey, event, eventTimestamp }, client = pool) {
    if (!licenseKey || !event || !eventTimestamp) return null;

    const sql = `
      SELECT id, event, processed, created_at
      FROM appsumo_license_events
      WHERE license_key = $1
        AND event = $2
        AND event_timestamp = $3
        AND processed = true
      LIMIT 1;
    `;

    const res = await client.query(sql, [licenseKey.trim(), event.trim(), Number(eventTimestamp)]);
    return res.rows.length > 0 ? res.rows[0] : null;
  },

  /**
   * Find all events for a given license key (audit log)
   */
  async findEventsByLicenseKey(licenseKey, client = pool) {
    if (!licenseKey) return [];

    const sql = `
      SELECT *
      FROM appsumo_license_events
      WHERE license_key = $1
      ORDER BY created_at DESC;
    `;

    const res = await client.query(sql, [licenseKey.trim()]);
    return res.rows.map(mapEventRow);
  },

  /**
   * List all licenses for SuperAdmin / Admin support dashboard
   */
  async findAllLicenses({ search = '', status = '', tier = '', limit = 50, offset = 0 } = {}, client = pool) {
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`al.status = $${paramIndex++}`);
      values.push(status);
    }

    if (tier) {
      conditions.push(`al.tier = $${paramIndex++}`);
      values.push(parseInt(tier, 10));
    }

    if (search) {
      const q = `%${search.toLowerCase().trim()}%`;
      conditions.push(`(
        LOWER(al.license_key) LIKE $${paramIndex} OR
        LOWER(COALESCE(o.name, '')) LIKE $${paramIndex} OR
        LOWER(COALESCE(o.code, '')) LIKE $${paramIndex} OR
        LOWER(COALESCE(u.email, '')) LIKE $${paramIndex}
      )`);
      values.push(q);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM appsumo_licenses al
      LEFT JOIN organizations o ON o.id = al.organization_id
      LEFT JOIN users u ON u.id = al.activated_by_user_id
      ${whereClause};
    `;
    const countRes = await client.query(countSql, values);
    const total = countRes.rows[0]?.total || 0;

    const sql = `
      ${BASE_LICENSE_SELECT}
      ${whereClause}
      ORDER BY al.last_event_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;

    values.push(parseInt(limit, 10), parseInt(offset, 10));
    const res = await client.query(sql, values);

    return {
      licenses: res.rows.map(mapLicenseRow),
      total,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    };
  },
};
