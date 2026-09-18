import { pool } from '../config/db.js';
import crypto from 'crypto';

/**
 * Maps raw database row from admin_audit_logs to standardized model
 */
const mapAuditLogRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.org_id,
    actorUserId: row.actor_user_id,
    actorName: row.actor_name ? `${row.actor_first_name || ''} ${row.actor_last_name || ''}`.trim() : row.actor_user_id,
    actorEmail: row.actor_email || null,
    actorRole: row.actor_role,
    targetType: row.target_type,
    targetId: row.target_id,
    action: row.action,
    previousValue: row.previous_value,
    newValue: row.new_value,
    reason: row.reason || '',
    ipAddress: row.ip_address,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
  };
};

/**
 * Maps raw database row from admin_configurations to standardized model
 */
const mapConfigRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.org_id,
    configKey: row.config_key,
    configValue: row.config_value,
    category: row.category,
    description: row.description || '',
    updatedBy: row.updated_by,
    updatedByName: row.updated_by_name ? `${row.upd_first_name || ''} ${row.upd_last_name || ''}`.trim() : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  };
};

export const adminRepository = {
  /**
   * Record an immutable audit log entry for a sensitive administrative action
   */
  async recordAuditLog({
    orgId,
    actorUserId,
    actorRole,
    targetType,
    targetId,
    action,
    previousValue = null,
    newValue = null,
    reason = '',
    ipAddress = null,
  }) {
    const id = `audit-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const sql = `
      INSERT INTO admin_audit_logs (
        id, org_id, actor_user_id, actor_role, target_type, target_id, action,
        previous_value, new_value, reason, ip_address, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      RETURNING *;
    `;
    const res = await pool.query(sql, [
      id,
      orgId,
      actorUserId,
      actorRole,
      targetType,
      targetId,
      action,
      previousValue ? JSON.stringify(previousValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      reason,
      ipAddress,
    ]);
    return mapAuditLogRow(res.rows[0]);
  },

  /**
   * Find audit logs matching criteria with pagination
   */
  async findAuditLogs(orgId, filters = {}) {
    const {
      actorUserId,
      targetType,
      targetId,
      action,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
    } = filters;

    const conditions = ['a.org_id = $1'];
    const values = [orgId];
    let idx = 2;

    if (actorUserId) {
      conditions.push(`a.actor_user_id = $${idx++}`);
      values.push(actorUserId);
    }
    if (targetType) {
      conditions.push(`a.target_type = $${idx++}`);
      values.push(targetType);
    }
    if (targetId) {
      conditions.push(`a.target_id = $${idx++}`);
      values.push(targetId);
    }
    if (action) {
      conditions.push(`a.action = $${idx++}`);
      values.push(action);
    }
    if (startDate) {
      conditions.push(`a.created_at >= $${idx++}`);
      values.push(startDate);
    }
    if (endDate) {
      conditions.push(`a.created_at <= $${idx++}`);
      values.push(endDate);
    }

    const whereClause = conditions.join(' AND ');

    // Total count query
    const countSql = `
      SELECT COUNT(*) AS total
      FROM admin_audit_logs a
      WHERE ${whereClause};
    `;
    const countRes = await pool.query(countSql, values);
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    // Rows query
    const rowsSql = `
      SELECT 
        a.*,
        u.first_name AS actor_first_name,
        u.last_name AS actor_last_name,
        u.email AS actor_email,
        u.id AS actor_name
      FROM admin_audit_logs a
      LEFT JOIN users u ON u.id = a.actor_user_id
      WHERE ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    values.push(Math.min(Math.max(1, parseInt(limit, 10) || 50), 200));
    values.push(Math.max(0, parseInt(offset, 10) || 0));

    const rowsRes = await pool.query(rowsSql, values);
    return {
      total,
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0,
      logs: rowsRes.rows.map(mapAuditLogRow),
    };
  },

  /**
   * Find configurations by org and optional category (falls back to org-1 template defaults if none configured)
   */
  async findConfigurations(orgId, category = null) {
    const queryConfigs = async (targetOrg) => {
      let sql = `
        SELECT 
          c.*,
          u.first_name AS upd_first_name,
          u.last_name AS upd_last_name,
          u.id AS updated_by_name
        FROM admin_configurations c
        LEFT JOIN users u ON u.id = c.updated_by
        WHERE c.org_id = $1
      `;
      const values = [targetOrg];

      if (category) {
        sql += ' AND c.category = $2';
        values.push(category);
      }

      sql += ' ORDER BY c.config_key ASC;';
      const res = await pool.query(sql, values);
      return res.rows.map(mapConfigRow);
    };

    let configs = await queryConfigs(orgId);
    if (configs.length === 0 && orgId !== 'org-1') {
      configs = await queryConfigs('org-1');
    }
    return configs;
  },

  /**
   * Find configuration by key (falls back to org-1 template defaults if not customized)
   */
  async findConfigByKey(orgId, configKey) {
    const sql = `
      SELECT 
        c.*,
        u.first_name AS upd_first_name,
        u.last_name AS upd_last_name,
        u.id AS updated_by_name
      FROM admin_configurations c
      LEFT JOIN users u ON u.id = c.updated_by
      WHERE c.org_id = $1 AND c.config_key = $2
      LIMIT 1;
    `;
    let res = await pool.query(sql, [orgId, configKey]);
    if (res.rows.length === 0 && orgId !== 'org-1') {
      res = await pool.query(sql, ['org-1', configKey]);
    }
    return res.rows.length > 0 ? mapConfigRow(res.rows[0]) : null;
  },

  /**
   * Upsert administrative configuration
   */
  async upsertConfiguration({
    orgId,
    configKey,
    configValue,
    category = 'EXIT_OFFBOARDING',
    description = '',
    updatedBy = null,
  }) {
    const id = `cfg-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const sql = `
      INSERT INTO admin_configurations (
        id, org_id, config_key, config_value, category, description, updated_by, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      ON CONFLICT (org_id, config_key)
      DO UPDATE SET
        config_value = EXCLUDED.config_value,
        category = COALESCE(EXCLUDED.category, admin_configurations.category),
        description = COALESCE(EXCLUDED.description, admin_configurations.description),
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
      RETURNING *;
    `;
    const res = await pool.query(sql, [
      id,
      orgId,
      configKey,
      typeof configValue === 'object' ? JSON.stringify(configValue) : configValue,
      category,
      description,
      updatedBy,
    ]);
    return mapConfigRow(res.rows[0]);
  },

  /**
   * Get administrative system overview metrics for dashboard/monitoring
   */
  async getAdminSystemOverview(orgId) {
    // 1. Users count by status
    const usersCountSql = `
      SELECT 
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'Active') AS active,
        COUNT(*) FILTER (WHERE status = 'Inactive') AS inactive
      FROM users
      WHERE org_id = $1;
    `;
    const usersRes = await pool.query(usersCountSql, [orgId]);

    // 2. Roles and permissions counts
    const rolesRes = await pool.query('SELECT COUNT(*) AS total FROM roles;');
    const permsRes = await pool.query('SELECT COUNT(*) AS total FROM permissions;');

    // 3. Exits breakdown
    const exitsSql = `
      SELECT 
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status IN ('SUBMITTED', 'PENDING_APPROVAL')) AS pending,
        COUNT(*) FILTER (WHERE status = 'APPROVED') AS approved,
        COUNT(*) FILTER (WHERE status = 'EXIT_COMPLETED') AS completed,
        COUNT(*) FILTER (WHERE status = 'REJECTED') AS rejected
      FROM exit_requests
      WHERE org_id = $1;
    `;
    const exitsRes = await pool.query(exitsSql, [orgId]);

    // 4. Employees count by status
    const empsSql = `
      SELECT 
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'Active') AS active,
        COUNT(*) FILTER (WHERE status = 'Exited') AS exited,
        COUNT(*) FILTER (WHERE status = 'Notice Period') AS on_notice
      FROM employees
      WHERE org_id = $1;
    `;
    const empsRes = await pool.query(empsSql, [orgId]);

    // 5. Recent audit logs count (last 24 hours)
    const auditCountSql = `
      SELECT COUNT(*) AS recent_count
      FROM admin_audit_logs
      WHERE org_id = $1 AND created_at >= NOW() - INTERVAL '24 HOURS';
    `;
    const auditRes = await pool.query(auditCountSql, [orgId]);

    return {
      users: {
        total: parseInt(usersCountSql ? usersRes.rows[0]?.total || 0 : 0, 10),
        active: parseInt(usersRes.rows[0]?.active || 0, 10),
        inactive: parseInt(usersRes.rows[0]?.inactive || 0, 10),
      },
      roles: {
        total: parseInt(rolesRes.rows[0]?.total || 0, 10),
      },
      permissions: {
        total: parseInt(permsRes.rows[0]?.total || 0, 10),
      },
      employees: {
        total: parseInt(empsRes.rows[0]?.total || 0, 10),
        active: parseInt(empsRes.rows[0]?.active || 0, 10),
        onNotice: parseInt(empsRes.rows[0]?.on_notice || 0, 10),
        exited: parseInt(empsRes.rows[0]?.exited || 0, 10),
      },
      exits: {
        total: parseInt(exitsRes.rows[0]?.total || 0, 10),
        pending: parseInt(exitsRes.rows[0]?.pending || 0, 10),
        approved: parseInt(exitsRes.rows[0]?.approved || 0, 10),
        completed: parseInt(exitsRes.rows[0]?.completed || 0, 10),
        rejected: parseInt(exitsRes.rows[0]?.rejected || 0, 10),
      },
      auditLogs24h: parseInt(auditRes.rows[0]?.recent_count || 0, 10),
    };
  },
};
