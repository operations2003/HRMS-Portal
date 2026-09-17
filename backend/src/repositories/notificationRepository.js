import { pool } from '../config/db.js';

/**
 * Format raw notification database row into standard structure
 */
const mapNotificationRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.org_id,
    userId: row.user_id,
    eventType: row.event_type,
    title: row.title,
    message: row.message,
    entityType: row.entity_type,
    entityId: row.entity_id,
    actionUrl: row.action_url || '',
    isRead: row.is_read,
    readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
  };
};

export const notificationRepository = {
  /**
   * Create single notification record
   */
  async create({ id, orgId, userId, eventType, title, message, entityType, entityId, actionUrl = '' }) {
    const notifId = id || `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const query = `
      INSERT INTO notifications (
        id, org_id, user_id, event_type, title, message, entity_type, entity_id, action_url, is_read, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE, NOW())
      RETURNING *;
    `;
    const values = [notifId, orgId, userId, eventType, title, message, entityType, entityId, actionUrl];
    try {
      const { rows } = await pool.query(query, values);
      return mapNotificationRow(rows[0]);
    } catch (err) {
      if (err.constraint === 'notifications_event_type_check') {
        values[3] = 'GENERAL_ALERT';
        const { rows } = await pool.query(query, values);
        return mapNotificationRow(rows[0]);
      }
      throw err;
    }
  },

  /**
   * Create multiple notifications (e.g. for payroll batch processing across company)
   */
  async createBatch(notifications) {
    if (!notifications || notifications.length === 0) return [];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const created = [];
      for (const n of notifications) {
        const notifId = n.id || `notif-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const query = `
          INSERT INTO notifications (
            id, org_id, user_id, event_type, title, message, entity_type, entity_id, action_url, is_read, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE, NOW())
          RETURNING *;
        `;
        const values = [notifId, n.orgId, n.userId, n.eventType, n.title, n.message, n.entityType, n.entityId, n.actionUrl || ''];
        const { rows } = await client.query(query, values);
        created.push(mapNotificationRow(rows[0]));
      }
      await client.query('COMMIT');
      return created;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Find paginated notifications for a user
   */
  async findByUser(userId, { limit = 20, offset = 0, unreadOnly = false } = {}) {
    let query = `
      SELECT * FROM notifications
      WHERE user_id = $1
    `;
    const params = [userId];

    if (unreadOnly) {
      query += ` AND is_read = FALSE`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2};`;
    params.push(limit, offset);

    const { rows } = await pool.query(query, params);
    return rows.map(mapNotificationRow);
  },

  /**
   * Count unread notifications for a user
   */
  async countUnread(userId) {
    const query = `SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = FALSE;`;
    const { rows } = await pool.query(query, [userId]);
    return rows[0]?.count || 0;
  },

  /**
   * Mark single notification as read
   */
  async markAsRead(notificationId, userId) {
    const query = `
      UPDATE notifications
      SET is_read = TRUE, read_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [notificationId, userId]);
    return mapNotificationRow(rows[0]);
  },

  /**
   * Find single notification by ID and User ID
   */
  async findById(notificationId, userId) {
    const query = `
      SELECT * FROM notifications
      WHERE id = $1 AND user_id = $2
      LIMIT 1;
    `;
    const { rows } = await pool.query(query, [notificationId, userId]);
    return mapNotificationRow(rows[0]);
  },

  /**
   * Mark single notification as unread
   */
  async markAsUnread(notificationId, userId) {
    const query = `
      UPDATE notifications
      SET is_read = FALSE, read_at = NULL
      WHERE id = $1 AND user_id = $2
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [notificationId, userId]);
    return mapNotificationRow(rows[0]);
  },

  /**
   * Mark all unread notifications as read for a user
   */
  async markAllAsRead(userId) {
    const query = `
      UPDATE notifications
      SET is_read = TRUE, read_at = NOW()
      WHERE user_id = $1 AND is_read = FALSE;
    `;
    const result = await pool.query(query, [userId]);
    return result.rowCount;
  },
};

export default notificationRepository;

