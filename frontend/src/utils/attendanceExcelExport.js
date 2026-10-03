import * as XLSX from 'xlsx';
import { formatHoursToClock, formatOvertimeDuration } from './timeUtils.js';

/**
 * Format date string to YYYY-MM-DD
 */
export const getLocalDateString = (dateVal) => {
  if (!dateVal) return '';
  if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal.trim())) {
    return dateVal.trim();
  }
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA');
};

/**
 * Format time to 12-hour AM/PM string (e.g. "11:00 AM")
 */
export const formatTime12h = (timeVal) => {
  if (!timeVal) return '';
  const d = new Date(timeVal);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Format time to 12-hour with seconds (e.g. "11:00:25 AM")
 */
export const formatTimeWithSeconds = (timeVal) => {
  if (!timeVal) return '';
  const d = new Date(timeVal);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
};

/**
 * Get weekday name for a date
 */
export const getDayOfWeek = (dateVal, format = 'long') => {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { weekday: format });
};

/**
 * Build a structured Excel workbook with:
 * 1. Monthly Timesheet Matrix:
 *    - Columns: Employee Info, Day 1..Day N (Date header + Day header), followed by Summary
 *    - Under each day: "In Time - Out Time (Duration)" (e.g. "11:00 AM - 07:00 PM (8h 00m)")
 *    - End column: Total Hours Worked per Month
 * 2. Daily Attendance Logs:
 *    - Row-by-row table with Day, Date, In Time, Out Time, Window, Net Hours, Overtime, Status
 * 3. Monthly Employee Summary:
 *    - Aggregated total hours worked in month, present/absent/leave counts, overtime
 *
 * @param {Array} records - Attendance records
 * @param {Object} options - { filters, orgName, dateRangeLabel }
 */
export const exportAttendanceToExcel = (records = [], options = {}) => {
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('No attendance records available to export.');
  }

  const {
    filters = {},
    orgName = 'TaskNera HRMS',
    exportTitle = 'Monthly Attendance Timesheet',
  } = options;

  // Determine date range from records or filters
  const dateSet = new Set();
  records.forEach((r) => {
    const dStr = getLocalDateString(r.attendanceDate);
    if (dStr) dateSet.add(dStr);
  });

  let sortedDates = Array.from(dateSet).sort();

  // If a filter range is provided, ensure all dates in the range are represented in the matrix
  if (filters.startDate && filters.endDate) {
    const start = new Date(filters.startDate);
    const end = new Date(filters.endDate);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
      const allDatesInRange = [];
      const curr = new Date(start);
      // Limit to max 62 days to keep spreadsheet matrix manageable
      let count = 0;
      while (curr <= end && count < 62) {
        allDatesInRange.push(curr.toLocaleDateString('en-CA'));
        curr.setDate(curr.getDate() + 1);
        count++;
      }
      if (allDatesInRange.length > 0) {
        sortedDates = allDatesInRange;
      }
    }
  }

  // If still empty, use current month's dates
  if (sortedDates.length === 0) {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      sortedDates.push(d.toLocaleDateString('en-CA'));
    }
  }

  // Group records by employee
  const employeeMap = new Map();

  records.forEach((rec) => {
    const empId =
      rec.employeeId ||
      rec.employee?.id ||
      rec.employeeCode ||
      rec.employee?.employeeCode ||
      'UNKNOWN';
    const empCode = rec.employee?.employeeCode || rec.employeeCode || '—';
    const firstName = rec.employee?.firstName || rec.firstName || '';
    const lastName = rec.employee?.lastName || rec.lastName || '';
    const fullName =
      (firstName || lastName ? `${firstName} ${lastName}`.trim() : null) ||
      rec.fullName ||
      rec.employeeName ||
      'Staff Member';
    const dept =
      rec.employee?.departmentName ||
      rec.employee?.department?.name ||
      (typeof rec.department === 'object' ? rec.department?.name : rec.department) ||
      'General';
    const designation =
      rec.employee?.designationName ||
      rec.employee?.designation?.title ||
      rec.designation ||
      'Employee';
    const shiftTiming =
      rec.employee?.shiftTiming || rec.shiftTiming || '11:00 AM - 07:00 PM';

    if (!employeeMap.has(empId)) {
      employeeMap.set(empId, {
        id: empId,
        empCode,
        fullName,
        dept,
        designation,
        shiftTiming,
        dateMap: {},
        records: [],
      });
    }

    const empData = employeeMap.get(empId);
    const recDate = getLocalDateString(rec.attendanceDate);
    if (recDate) {
      empData.dateMap[recDate] = rec;
    }
    empData.records.push(rec);
  });

  const employeeList = Array.from(employeeMap.values()).sort((a, b) =>
    a.fullName.localeCompare(b.fullName)
  );

  // ==========================================
  // SHEET 1: Monthly Attendance Timesheet Matrix
  // ==========================================
  const matrixAoa = [];

  // Header Title Rows
  const periodLabel =
    filters.startDate && filters.endDate
      ? `${filters.startDate} to ${filters.endDate}`
      : sortedDates.length > 0
      ? `${sortedDates[0]} to ${sortedDates[sortedDates.length - 1]}`
      : 'Current Period';

  matrixAoa.push([`${orgName} — Monthly Attendance Timesheet`]);
  matrixAoa.push([
    `Report Period: ${periodLabel} | Total Employees: ${employeeList.length} | Generated: ${new Date().toLocaleString()}`,
  ]);
  matrixAoa.push([]); // blank spacing

  // Column Headers - Row 1: Date & Metadata
  const headerRow1 = [
    'Employee ID',
    'Employee Name',
    'Department',
    'Designation',
    'Assigned Shift',
  ];

  // Column Headers - Row 2: Day of Week
  const headerRow2 = ['', '', '', '', ''];

  sortedDates.forEach((dStr) => {
    const dateObj = new Date(dStr);
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
    const formattedDate = dateObj.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
    });

    headerRow1.push(formattedDate);
    headerRow2.push(dayName);
  });

  // Summary column headers at the end
  headerRow1.push(
    'Days Present',
    'Days Absent',
    'Days Leave',
    'Total Hours Worked (Month)',
    'Total Overtime (Month)'
  );
  headerRow2.push(
    'Count',
    'Count',
    'Count',
    'Clock / Decimal',
    'Approved OT'
  );

  matrixAoa.push(headerRow1);
  matrixAoa.push(headerRow2);

  // Populate Employee Rows
  employeeList.forEach((emp) => {
    const row = [
      emp.empCode,
      emp.fullName,
      emp.dept,
      emp.designation,
      emp.shiftTiming,
    ];

    let totalMonthHours = 0;
    let totalMonthOT = 0;
    let presentCount = 0;
    let absentCount = 0;
    let leaveCount = 0;

    sortedDates.forEach((dStr) => {
      const rec = emp.dateMap[dStr];
      if (!rec) {
        row.push('—');
        return;
      }

      const status = (rec.status || '').toUpperCase();
      const inTime = formatTime12h(rec.checkIn);
      const outTime = formatTime12h(rec.checkOut);
      const hoursNum = Number(rec.totalHours || 0);
      const otNum = Number(rec.overtimeHours || 0);

      totalMonthHours += hoursNum;
      totalMonthOT += otNum;

      if (status === 'PRESENT' || status === 'LATE' || status === 'HALF_DAY' || status === 'REGULARIZED') {
        presentCount++;
        if (inTime && outTime) {
          row.push(`${inTime} - ${outTime} (${formatHoursToClock(hoursNum)})`);
        } else if (inTime) {
          row.push(`${inTime} - Active`);
        } else {
          row.push(`Present (${formatHoursToClock(hoursNum)})`);
        }
      } else if (status === 'ABSENT') {
        absentCount++;
        row.push('ABSENT');
      } else if (status === 'ON_LEAVE') {
        leaveCount++;
        row.push('LEAVE');
      } else if (status === 'HOLIDAY') {
        row.push('HOLIDAY');
      } else if (status === 'WEEKEND') {
        row.push('WEEKEND');
      } else {
        row.push(status || '—');
      }
    });

    // Summary at the end of the employee's row
    row.push(
      presentCount,
      absentCount,
      leaveCount,
      `${formatHoursToClock(totalMonthHours)} (${totalMonthHours.toFixed(2)}h)`,
      totalMonthOT > 0 ? `+${formatHoursToClock(totalMonthOT)}` : '—'
    );

    matrixAoa.push(row);
  });

  const matrixSheet = XLSX.utils.aoa_to_sheet(matrixAoa);

  // Auto-width columns for matrix sheet
  const colWidthsMatrix = [
    { wch: 14 }, // Employee ID
    { wch: 24 }, // Name
    { wch: 20 }, // Department
    { wch: 22 }, // Designation
    { wch: 22 }, // Shift
  ];
  sortedDates.forEach(() => {
    colWidthsMatrix.push({ wch: 25 }); // Date/Day punch window column
  });
  colWidthsMatrix.push(
    { wch: 14 }, // Present
    { wch: 14 }, // Absent
    { wch: 14 }, // Leave
    { wch: 26 }, // Total Hours Worked
    { wch: 22 }  // Overtime
  );
  matrixSheet['!cols'] = colWidthsMatrix;

  // ==========================================
  // SHEET 2: Daily Attendance Register (Row-by-Row)
  // ==========================================
  const dailyRows = [];

  // Sort all records chronologically and by employee
  const sortedRecords = [...records].sort((a, b) => {
    const dComp = (b.attendanceDate || '').localeCompare(a.attendanceDate || '');
    if (dComp !== 0) return dComp;
    const nameA = a.employee?.firstName || a.fullName || '';
    const nameB = b.employee?.firstName || b.fullName || '';
    return nameA.localeCompare(nameB);
  });

  sortedRecords.forEach((rec, idx) => {
    const dStr = getLocalDateString(rec.attendanceDate);
    const dayOfWeek = getDayOfWeek(rec.attendanceDate, 'long');
    const inTime = formatTimeWithSeconds(rec.checkIn);
    const outTime = formatTimeWithSeconds(rec.checkOut);
    const inTime12 = formatTime12h(rec.checkIn);
    const outTime12 = formatTime12h(rec.checkOut);
    const punchWindow =
      inTime12 && outTime12
        ? `${inTime12} – ${outTime12}`
        : inTime12
        ? `${inTime12} – (Active Session)`
        : '—';

    const hours = Number(rec.totalHours || 0);
    const ot = Number(rec.overtimeHours || 0);
    const breakMins = Number(rec.breakDurationMinutes || 0);

    const empCode = rec.employee?.employeeCode || rec.employeeCode || '—';
    const empName =
      (rec.employee?.firstName || rec.employee?.lastName
        ? `${rec.employee?.firstName || ''} ${rec.employee?.lastName || ''}`.trim()
        : null) ||
      rec.fullName ||
      rec.employeeName ||
      'Staff Member';
    const dept =
      rec.employee?.departmentName ||
      rec.employee?.department?.name ||
      (typeof rec.department === 'object' ? rec.department?.name : rec.department) ||
      'General';
    const designation =
      rec.employee?.designationName ||
      rec.employee?.designation?.title ||
      rec.designation ||
      'Employee';
    const shift =
      rec.employee?.shiftTiming || rec.shiftTiming || '11:00 AM - 07:00 PM';

    // Parse remarks
    let remarks = '';
    if (rec.notes) remarks += rec.notes;
    if (rec.regularizationReason) {
      remarks += (remarks ? ' | ' : '') + `Adjusted: ${rec.regularizationReason}`;
    }

    dailyRows.push({
      '#': idx + 1,
      'Employee ID': empCode,
      'Employee Name': empName,
      Department: dept,
      Designation: designation,
      Date: dStr,
      Day: dayOfWeek,
      'Logged In Time': inTime || '—',
      'Logged Out Time': outTime || (inTime ? 'Active Session' : '—'),
      'Login - Logout Window': punchWindow,
      'Hours Worked (HH:MM)': formatHoursToClock(hours),
      'Hours Worked (Decimal)': hours,
      'Break (Minutes)': breakMins > 0 ? `${breakMins} mins` : '0 mins',
      'Overtime (OT)': ot > 0 ? `+${formatHoursToClock(ot)}` : '—',
      Status: (rec.status || '').toUpperCase(),
      'Assigned Shift': shift,
      'Regularized / Adjusted': rec.isRegularized ? 'Yes' : 'No',
      Remarks: remarks || '—',
    });
  });

  const dailySheet = XLSX.utils.json_to_sheet(dailyRows);
  dailySheet['!cols'] = [
    { wch: 6 },  // #
    { wch: 14 }, // Employee ID
    { wch: 24 }, // Name
    { wch: 20 }, // Department
    { wch: 22 }, // Designation
    { wch: 14 }, // Date
    { wch: 14 }, // Day
    { wch: 18 }, // Logged In
    { wch: 18 }, // Logged Out
    { wch: 26 }, // Window
    { wch: 22 }, // Hours Worked
    { wch: 22 }, // Hours Decimal
    { wch: 16 }, // Break
    { wch: 16 }, // OT
    { wch: 14 }, // Status
    { wch: 24 }, // Shift
    { wch: 22 }, // Regularized
    { wch: 35 }, // Remarks
  ];

  // ==========================================
  // SHEET 3: Monthly Hours Summary (Per Employee)
  // ==========================================
  const summaryRows = employeeList.map((emp, idx) => {
    let totalHours = 0;
    let totalOT = 0;
    let presentDays = 0;
    let lateDays = 0;
    let halfDays = 0;
    let absentDays = 0;
    let leaveDays = 0;

    emp.records.forEach((rec) => {
      const h = Number(rec.totalHours || 0);
      const o = Number(rec.overtimeHours || 0);
      totalHours += h;
      totalOT += o;

      const st = (rec.status || '').toUpperCase();
      if (st === 'PRESENT') presentDays++;
      else if (st === 'LATE') lateDays++;
      else if (st === 'HALF_DAY') halfDays++;
      else if (st === 'ABSENT') absentDays++;
      else if (st === 'ON_LEAVE') leaveDays++;
      else if (st === 'REGULARIZED') presentDays++;
    });

    const totalDaysWorked = presentDays + lateDays + halfDays;
    const avgDailyHours =
      totalDaysWorked > 0 ? (totalHours / totalDaysWorked).toFixed(2) : '0.00';

    return {
      '#': idx + 1,
      'Employee ID': emp.empCode,
      'Employee Name': emp.fullName,
      Department: emp.dept,
      Designation: emp.designation,
      'Assigned Shift': emp.shiftTiming,
      'Period / Month': periodLabel,
      'Total Working Days': totalDaysWorked,
      'Present Days': presentDays,
      'Late Arrivals': lateDays,
      'Half Days': halfDays,
      'Absent Days': absentDays,
      'Leave Days': leaveDays,
      'Total Hours Worked (Month)': formatHoursToClock(totalHours),
      'Total Hours Decimal': parseFloat(totalHours.toFixed(2)),
      'Total Overtime (Month)':
        totalOT > 0 ? `+${formatHoursToClock(totalOT)}` : '0h 00m',
      'Average Daily Hours': `${avgDailyHours} hrs`,
    };
  });

  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  summarySheet['!cols'] = [
    { wch: 6 },  // #
    { wch: 14 }, // Employee ID
    { wch: 24 }, // Name
    { wch: 20 }, // Department
    { wch: 22 }, // Designation
    { wch: 22 }, // Shift
    { wch: 26 }, // Period
    { wch: 18 }, // Total Days Worked
    { wch: 14 }, // Present
    { wch: 14 }, // Late
    { wch: 14 }, // Half Days
    { wch: 14 }, // Absent
    { wch: 14 }, // Leave
    { wch: 26 }, // Total Hours Worked
    { wch: 20 }, // Total Hours Decimal
    { wch: 22 }, // Total OT
    { wch: 20 }, // Avg Daily Hours
  ];

  // ==========================================
  // Assemble Workbook & Trigger Download
  // ==========================================
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, matrixSheet, 'Monthly Timesheet');
  XLSX.utils.book_append_sheet(wb, dailySheet, 'Daily Attendance Logs');
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Monthly Hours Summary');

  // File Name
  const cleanOrg = orgName.replace(/[^a-zA-Z0-9_-]/g, '_');
  let cleanPeriod = periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
  if (cleanPeriod.length > 25) cleanPeriod = cleanPeriod.substring(0, 25);
  const fileName = `${cleanOrg}_Attendance_Monthly_Timesheet_${cleanPeriod}.xlsx`;

  XLSX.writeFile(wb, fileName);
  return { fileName, recordCount: records.length, employeeCount: employeeList.length };
};
