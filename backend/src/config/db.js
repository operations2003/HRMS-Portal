import pg from 'pg';
import { config } from './index.js';

const { Pool, Client } = pg;

/**
 * Validates and sanitizes database connection URLs:
 * - Strips accidental surrounding quotes
 * - Safely percent-encodes passwords containing special characters (e.g. '@' -> '%40')
 *   to prevent connection string parsers from mistaking password fragments for hostnames.
 */
export const sanitizeDatabaseUrl = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;

  let url = rawUrl.trim();
  if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
    url = url.slice(1, -1).trim();
  }

  const lastAt = url.lastIndexOf('@');
  if (lastAt === -1) return url;

  const credentialsPart = url.substring(0, lastAt);
  const hostPart = url.substring(lastAt + 1);

  const schemeEnd = credentialsPart.indexOf('://');
  if (schemeEnd === -1) return url;

  const scheme = credentialsPart.substring(0, schemeEnd + 3);
  const userInfo = credentialsPart.substring(schemeEnd + 3);

  const colonIdx = userInfo.indexOf(':');
  if (colonIdx === -1) return url;

  const username = userInfo.substring(0, colonIdx);
  const password = userInfo.substring(colonIdx + 1);

  const safePassword = encodeURIComponent(decodeURIComponent(password));

  return `${scheme}${username}:${safePassword}@${hostPart}`;
};

const activeDatabaseUrl = sanitizeDatabaseUrl(config.db.databaseUrl);
const activeDirectUrl = sanitizeDatabaseUrl(config.db.directUrl);

/**
 * Validates presence of connection strings without printing them.
 */
if (!activeDatabaseUrl) {
  console.warn('⚠️ WARNING: DATABASE_URL is not defined in environment variables.');
}

/**
 * Standard SSL configuration for Supabase PostgreSQL
 */
const isLocalDb = !activeDatabaseUrl || 
  activeDatabaseUrl.includes('localhost') || 
  activeDatabaseUrl.includes('127.0.0.1') || 
  process.env.DB_SSL === 'false';

const sslConfig = isLocalDb ? false : {
  rejectUnauthorized: false,
};

/**
 * PostgreSQL Connection Pool for Application Traffic
 * Uses DATABASE_URL (Supabase Transaction-mode Pooler, Port 6543)
 */
export const pool = new Pool({
  connectionString: activeDatabaseUrl,
  ssl: sslConfig,
  max: 20, // Max concurrent connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Capture and handle unexpected idle client errors
pool.on('error', (err) => {
  console.error('💥 Unexpected PostgreSQL pool error on idle client:', err.message);
});

/**
 * Helper to get a direct session Client for schema management and migrations
 * Uses DIRECT_URL (Supabase Session-mode connection, Port 5432)
 * Caller is responsible for connecting and disconnecting this client.
 *
 * @returns {Client}
 */
export const getDirectClient = () => {
  if (!activeDirectUrl) {
    throw new Error('DIRECT_URL is not configured in environment variables.');
  }

  return new Client({
    connectionString: activeDirectUrl,
    ssl: sslConfig,
    connectionTimeoutMillis: 10000,
  });
};

/**
 * Parameterized Query Helper
 * Executes SQL queries through the pool safely
 *
 * @param {string} text - SQL statement
 * @param {Array} [params] - Query parameters
 * @returns {Promise<pg.QueryResult>}
 */
export const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (config.nodeEnv === 'development' && duration > 100) {
      console.log(`[SQL] Query took ${duration}ms (Rows: ${res.rowCount})`);
    }
    return res;
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`[SQL ERROR] Query failed after ${duration}ms:`, error.message);
    throw error;
  }
};

/**
 * Tests connection to the PostgreSQL database via the application pool
 * @returns {Promise<{ success: boolean, dbName?: string, currentTime?: string, version?: string, error?: string }>}
 */
export const testConnection = async () => {
  try {
    const res = await pool.query(
      'SELECT NOW() AS current_time, current_database() AS db_name, version() AS db_version;'
    );
    const row = res.rows[0];
    return {
      success: true,
      dbName: row.db_name,
      currentTime: row.current_time,
      version: row.db_version ? row.db_version.split(' ')[0] + ' ' + row.db_version.split(' ')[1] : 'PostgreSQL',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Graceful pool shutdown
 */
export const closePool = async () => {
  try {
    await pool.end();
    console.log('🔒 PostgreSQL connection pool closed gracefully.');
  } catch (error) {
    console.error('Error while closing PostgreSQL connection pool:', error.message);
  }
};

// Process-level termination hooks for graceful cleanup
process.on('SIGINT', async () => {
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closePool();
  process.exit(0);
});

