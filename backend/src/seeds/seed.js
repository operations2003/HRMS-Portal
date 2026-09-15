import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDirectClient } from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runSeed = async () => {
  console.log('🌱 Starting HRMS Phase 1 Database Seeder (Direct Session Mode)...\n');
  const client = getDirectClient();

  try {
    await client.connect();
    console.log('✅ Connected to database for seed management.');

    const seedFilePath = path.join(__dirname, 'seed.sql');
    if (!fs.existsSync(seedFilePath)) {
      throw new Error(`Seed file not found at: ${seedFilePath}`);
    }

    const sql = fs.readFileSync(seedFilePath, 'utf8');

    console.log('   ⚡ Executing idempotent seed script in transaction...');
    const startTime = Date.now();

    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('COMMIT');
      const duration = Date.now() - startTime;
      console.log(`   ✅ Seed script executed successfully (${duration}ms).\n`);
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    }

    // Report record counts for seeded test records
    console.log('📊 Verifying Seeded Foundation Records in Database:');

    const orgRes = await client.query("SELECT id, name, code, status FROM organizations WHERE id = 'org-acme';");
    console.log(`   🏢 Organizations : ${orgRes.rowCount} record (Code: ${orgRes.rows[0]?.code || 'N/A'})`);

    const deptRes = await client.query("SELECT id, name, code FROM departments WHERE org_id = 'org-acme';");
    console.log(`   📂 Departments   : ${deptRes.rowCount} records (${deptRes.rows.map((r) => r.code).join(', ')})`);

    const desigRes = await client.query("SELECT id, title, code FROM designations WHERE org_id = 'org-acme';");
    console.log(`   🏷️  Designations  : ${desigRes.rowCount} records (${desigRes.rows.map((r) => r.code).join(', ')})`);

    const roleRes = await client.query("SELECT id, name FROM roles WHERE name IN ('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE');");
    console.log(`   🛡️  Standard Roles: ${roleRes.rowCount} records (${roleRes.rows.map((r) => r.name).join(', ')})`);

    const permRes = await client.query("SELECT COUNT(*) AS count FROM permissions;");
    console.log(`   🔑 Permissions   : ${permRes.rows[0].count} records`);

    const userRes = await client.query("SELECT id, email, first_name, last_name, status FROM users WHERE email LIKE '%@acme.example.com';");
    console.log(`   👤 Test Users    : ${userRes.rowCount} records:`);
    for (const u of userRes.rows) {
      console.log(`      - ${u.email} (${u.first_name} ${u.last_name}, Status: ${u.status})`);
    }

    const empRes = await client.query("SELECT id, employee_code, first_name, last_name, email FROM employees WHERE org_id = 'org-acme';");
    console.log(`   💼 Employees     : ${empRes.rowCount} records:`);
    for (const e of empRes.rows) {
      console.log(`      - [${e.employee_code}] ${e.first_name} ${e.last_name} (${e.email})`);
    }

    console.log('\n====================================================');
    console.log('🎉 Phase 1 test/seed data verified successfully!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('💥 Database seeding failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
};

runSeed();

