import { pool } from '../config/db.js';
import { calculateWorkingHoursAndOvertime, parseShiftTiming } from '../services/attendanceService.js';

/**
 * Historical attendance record repair and recalculation script.
 * Audits all attendance_records against each employee's assigned shift_timing,
 * corrects impossible durations, and normalizes working duration and overtime.
 */
async function fixAttendanceRecords() {
  console.log('====================================================');
  console.log('🛠️  Auditing and Recalculating Attendance Records');
  console.log('====================================================\n');

  try {
    const query = `
      SELECT 
        a.id,
        a.employee_id,
        TO_CHAR(a.attendance_date, 'YYYY-MM-DD') AS "attendanceDate",
        a.check_in,
        a.check_out,
        a.total_hours,
        a.overtime_hours,
        a.break_duration_minutes,
        a.break_history,
        a.notes,
        e.shift_timing,
        e.first_name,
        e.last_name
      FROM attendance_records a
      JOIN employees e ON e.id = a.employee_id
      ORDER BY a.attendance_date ASC, a.created_at ASC;
    `;

    const { rows } = await pool.query(query);
    console.log(`Found ${rows.length} total attendance records to audit.\n`);

    let updatedCount = 0;

    for (const row of rows) {
      if (!row.check_in || !row.check_out) {
        continue;
      }

      let checkIn = new Date(row.check_in);
      let checkOut = new Date(row.check_out);
      const shiftTiming = row.shift_timing || '11:00 AM - 07:00 PM';
      const shiftInfo = parseShiftTiming(shiftTiming);

      // Check for specific anomalies like 21+ hours or cross-day timestamps
      // e.g. att-1790063482581-191: Login 1:21 PM on Sep 22, Logout 11:34 AM on Sep 23 (intended 11:34 PM on Sep 22)
      if (row.id === 'att-1790063482581-191') {
        // Adjust checkout from 2026-09-23T06:04:33.098Z (11:34 AM IST) to 2026-09-22T18:04:33.098Z (11:34 PM IST)
        checkOut = new Date('2026-09-22T18:04:33.098Z');
      }

      const calc = calculateWorkingHoursAndOvertime({
        checkIn,
        checkOut,
        breakHistory: Array.isArray(row.break_history) ? row.break_history : [],
        breakDurationMinutes: row.break_duration_minutes,
        shiftTiming,
      });

      const oldTotalHours = parseFloat(row.total_hours);
      const oldOvertimeHours = parseFloat(row.overtime_hours);

      const hasChanged = 
        Math.abs(oldTotalHours - calc.totalHours) > 0.01 || 
        Math.abs(oldOvertimeHours - calc.overtimeHours) > 0.01 ||
        checkOut.getTime() !== new Date(row.check_out).getTime();

      if (hasChanged) {
        console.log(`[Record ${row.id}] ${row.first_name} ${row.last_name} (${row.attendanceDate})`);
        console.log(`  Shift Timing   : ${shiftTiming} (Scheduled: ${shiftInfo.scheduledDurationHours}h)`);
        console.log(`  Check-In       : ${checkIn.toISOString()}`);
        console.log(`  Check-Out      : ${checkOut.toISOString()}`);
        console.log(`  Total Hours    : ${oldTotalHours}h -> ${calc.totalHours}h`);
        console.log(`  Overtime Hours : ${oldOvertimeHours}h -> ${calc.overtimeHours}h`);
        console.log(`  Break Minutes  : ${calc.breakDurationMinutes}m\n`);

        await pool.query(
          `UPDATE attendance_records 
           SET check_out = $1, total_hours = $2, overtime_hours = $3, break_duration_minutes = $4, updated_at = NOW()
           WHERE id = $5`,
          [checkOut, calc.totalHours, calc.overtimeHours, calc.breakDurationMinutes, row.id]
        );

        updatedCount++;
      }
    }

    console.log(`====================================================`);
    console.log(`🎉 Audit Complete: Updated ${updatedCount} attendance record(s).`);
    console.log(`====================================================`);
    process.exit(0);
  } catch (err) {
    console.error('Audit failed:', err);
    process.exit(1);
  }
}

fixAttendanceRecords();
