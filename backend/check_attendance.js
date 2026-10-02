import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkAttendance() {
  try {
    console.log('Checking attendance records with ON_LEAVE status...\n');
    
    const result = await pool.query(`
      SELECT 
        id, 
        employee_id, 
        attendance_date, 
        status, 
        source, 
        notes,
        total_hours
      FROM attendance_records 
      WHERE attendance_date = '2026-10-06' 
        AND status = 'ON_LEAVE'
      ORDER BY attendance_date DESC
      LIMIT 10;
    `);
    
    console.log(`Found ${result.rows.length} ON_LEAVE records on Oct 6, 2026:\n`);
    result.rows.forEach(row => {
      console.log(`- Employee: ${row.employee_id}`);
      console.log(`  Date: ${row.attendance_date}`);
      console.log(`  Status: ${row.status}`);
      console.log(`  Source: ${row.source || 'NULL'}`);
      console.log(`  Hours: ${row.total_hours}`);
      console.log(`  Notes: ${row.notes || 'N/A'}`);
      console.log('');
    });
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkAttendance();
