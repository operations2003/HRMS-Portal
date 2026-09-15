import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDirectClient } from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runMigrations = async () => {
  console.log('🚀 Running HRMS Database Migrations (Supabase Direct Session Mode)...\n');
  const client = getDirectClient();

  try {
    await client.connect();
    console.log('✅ Connected to database for schema management.');

    // 1. Ensure migration tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Fetch already applied migrations
    const appliedResult = await client.query('SELECT migration_name FROM schema_migrations ORDER BY id ASC;');
    const appliedSet = new Set(appliedResult.rows.map((r) => r.migration_name));

    // 3. Discover SQL migration files
    const migrationsDir = __dirname;
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    let newMigrationsCount = 0;

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`   ⏭️  Skipping (already applied): ${file}`);
        continue;
      }

      console.log(`   ⚡ Applying migration: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      const start = Date.now();
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (migration_name) VALUES ($1);', [file]);
        await client.query('COMMIT');
        const duration = Date.now() - start;
        console.log(`   ✅ Successfully applied ${file} (${duration}ms)`);
        newMigrationsCount++;
      } catch (migrationError) {
        await client.query('ROLLBACK');
        console.error(`   ❌ Failed applying ${file}:`, migrationError.message);
        throw migrationError;
      }
    }

    console.log('\n====================================================');
    if (newMigrationsCount === 0) {
      console.log('✨ Schema is already up to date. No new migrations executed.');
    } else {
      console.log(`🎉 Successfully applied ${newMigrationsCount} new migration(s)!`);
    }
    console.log('====================================================\n');
  } catch (err) {
    console.error('💥 Migration execution failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
};

runMigrations();

