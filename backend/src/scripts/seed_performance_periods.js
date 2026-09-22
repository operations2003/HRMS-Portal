import { pool } from '../config/db.js';

async function seedPeriods() {
  try {
    const q = `
      INSERT INTO performance_periods (id, org_id, name, code, period_type, start_date, end_date, due_date, status)
      VALUES 
        ('period-6-months', 'org-1', '6 Months', '6-MONTHS', 'MID_YEAR', '2026-01-01', '2026-06-30', '2026-07-15', 'ACTIVE'),
        ('period-12-months', 'org-1', '12 Months', '12-MONTHS', 'ANNUAL', '2026-01-01', '2026-12-31', '2027-01-15', 'ACTIVE')
      ON CONFLICT (org_id, code) DO UPDATE SET name = EXCLUDED.name, status = 'ACTIVE'
      RETURNING *;
    `;
    const res = await pool.query(q);
    console.log('Successfully seeded performance periods:', res.rows);
    process.exit(0);
  } catch (e) {
    console.error('Error seeding periods:', e);
    process.exit(1);
  }
}

seedPeriods();
