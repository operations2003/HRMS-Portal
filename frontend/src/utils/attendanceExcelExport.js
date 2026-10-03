import ExcelJS from 'exceljs';
import { formatHoursToClock, formatOvertimeDuration } from './timeUtils.js';

/**
 * Format date value to YYYY-MM-DD
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
 * Format date to readable DD-MMM-YYYY (e.g. 26-Sep-2026)
 */
export const formatDisplayDate = (dateVal) => {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

/**
 * Format date to short DD-MMM (e.g. 26-Sep)
 */
export const formatShortDate = (dateVal) => {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  return `${day}-${month}`;
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

// ==========================================
// Professional Corporate Styling Tokens
// ==========================================
const COLORS = {
  NAVY_HEADER: 'FF1E3A8A',    // Deep Royal Navy Blue
  NAVY_SUBHEADER: 'FF1E293B', // Dark Slate
  WHITE: 'FFFFFFFF',
  SLATE_BG: 'FFF8FAFC',
  ZEBRA_ROW: 'FFF1F5F9',
  BORDER_GRAY: 'FFCBD5E1',
  BORDER_THIN: 'FFE2E8F0',
  // Status Colors
  PRESENT_BG: 'FFDCFCE7',    // Emerald 100
  PRESENT_TXT: 'FF166534',   // Emerald 800
  ABSENT_BG: 'FFFFE4E6',     // Rose 100
  ABSENT_TXT: 'FF991B1B',    // Rose 800
  LEAVE_BG: 'FFFEF3C7',      // Amber 100
  LEAVE_TXT: 'FF92400E',     // Amber 800
  WEEKEND_BG: 'FFF1F5F9',    // Slate 100
  WEEKEND_TXT: 'FF64748B',   // Slate 500
  HOLIDAY_BG: 'FFE0E7FF',    // Indigo 100
  HOLIDAY_TXT: 'FF3730A3',   // Indigo 800
  SUMMARY_BG: 'FFEFF6FF',    // Blue 50
  SUMMARY_TXT: 'FF1E40AF',   // Blue 800
};

const BORDERS = {
  thin: {
    top: { style: 'thin', color: { argb: COLORS.BORDER_GRAY } },
    left: { style: 'thin', color: { argb: COLORS.BORDER_GRAY } },
    bottom: { style: 'thin', color: { argb: COLORS.BORDER_GRAY } },
    right: { style: 'thin', color: { argb: COLORS.BORDER_GRAY } },
  },
  header: {
    top: { style: 'medium', color: { argb: COLORS.NAVY_HEADER } },
    left: { style: 'thin', color: { argb: COLORS.BORDER_GRAY } },
    bottom: { style: 'medium', color: { argb: COLORS.NAVY_HEADER } },
    right: { style: 'thin', color: { argb: COLORS.BORDER_GRAY } },
  },
};

/**
 * Build & Download a high-precision, formatted Excel Workbook using ExcelJS:
 * 1. Monthly Timesheet (Matrix Grid: Date, Day, In-Out Window, Total Month Hours)
 * 2. Daily Attendance Logs (Row-by-Row clean register with borders and colors)
 * 3. Monthly Hours Summary (Per-employee monthly rollup)
 */
export const exportAttendanceToExcel = async (records = [], options = {}) => {
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('No attendance records available to export.');
  }

  const {
    filters = {},
    orgName = 'TaskNera HRMS',
    exportTitle = 'Monthly Attendance Timesheet',
  } = options;

  // Determine sorted unique dates from records
  const dateSet = new Set();
  records.forEach((r) => {
    const dStr = getLocalDateString(r.attendanceDate);
    if (dStr) dateSet.add(dStr);
  });

  // Default start date to '2026-09-26' if not specified or earlier
  const effectiveStartDate = filters.startDate || '2026-09-26';
  const effectiveEndDate =
    filters.endDate || new Date().toISOString().split('T')[0];

  // Fill in full date sequence between start and end date (up to 65 days)
  let sortedDates = [];
  const start = new Date(effectiveStartDate);
  const end = new Date(effectiveEndDate);
  if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
    const curr = new Date(start);
    let count = 0;
    while (curr <= end && count < 65) {
      sortedDates.push(curr.toLocaleDateString('en-CA'));
      curr.setDate(curr.getDate() + 1);
      count++;
    }
  }

  // Fallback to dates in records if range generation failed
  if (sortedDates.length === 0) {
    sortedDates = Array.from(dateSet).sort();
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

  // Period label
  const periodLabel = `${formatDisplayDate(effectiveStartDate)} to ${formatDisplayDate(effectiveEndDate)}`;

  // ==========================================
  // Initialize ExcelJS Workbook
  // ==========================================
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'TaskNera HRMS';
  workbook.created = new Date();

  // =========================================================================
  // SHEET 1: Monthly Attendance Timesheet (The Exact Matrix Requested)
  // =========================================================================
  const wsMatrix = workbook.addWorksheet('Monthly Timesheet', {
    views: [{ state: 'frozen', xSplit: 3, ySplit: 5 }],
    properties: { defaultRowHeight: 28 },
  });

  // 1. Title Banner (Rows 1 & 2)
  wsMatrix.mergeCells('A1:H1');
  const titleCell = wsMatrix.getCell('A1');
  titleCell.value = `${orgName} — Monthly Attendance Timesheet`;
  titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FF1E3A8A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  wsMatrix.getRow(1).height = 28;

  wsMatrix.mergeCells('A2:H2');
  const subTitleCell = wsMatrix.getCell('A2');
  subTitleCell.value = `Period: ${periodLabel} | Total Employees: ${employeeList.length} | Generated: ${new Date().toLocaleString()}`;
  subTitleCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF64748B' } };
  subTitleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  wsMatrix.getRow(2).height = 20;

  wsMatrix.getRow(3).height = 10; // blank separator

  // 2. Header Row 1: Date & Fixed Columns (Row 4)
  const row4Values = ['Employee ID', 'Employee Name', 'Department'];
  // 3. Header Row 2: Day of Week & Subheaders (Row 5)
  const row5Values = ['Code', 'Full Name', 'Team / Unit'];

  sortedDates.forEach((dStr) => {
    const d = new Date(dStr);
    const shortDate = formatShortDate(d);
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    row4Values.push(shortDate);
    row5Values.push(dayName);
  });

  // Summary headers at the end
  row4Values.push(
    'Days Present',
    'Days Absent',
    'Days Leave',
    'Total Hours Worked (Month)',
    'Total Overtime'
  );
  row5Values.push(
    'Present',
    'Absent',
    'Leaves',
    'HH:MM (Decimal)',
    'Approved OT'
  );

  const row4 = wsMatrix.addRow(row4Values);
  const row5 = wsMatrix.addRow(row5Values);
  row4.height = 24;
  row5.height = 22;

  // Format Header Rows 4 & 5
  row4.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.NAVY_HEADER },
    };
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.WHITE } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = BORDERS.header;
  });

  row5.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.NAVY_SUBHEADER },
    };
    cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFE2E8F0' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = BORDERS.thin;
  });

  // 4. Populate Employee Data Rows in Sheet 1
  employeeList.forEach((emp, empIdx) => {
    let totalMonthHours = 0;
    let totalMonthOT = 0;
    let presentCount = 0;
    let absentCount = 0;
    let leaveCount = 0;

    const rowData = [emp.empCode, emp.fullName, emp.dept];

    sortedDates.forEach((dStr) => {
      const rec = emp.dateMap[dStr];
      const d = new Date(dStr);
      const dayOfWeek = d.getDay(); // 0 = Sun, 6 = Sat

      if (!rec) {
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          rowData.push('WEEKEND');
        } else {
          rowData.push('—');
        }
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
          // Exactly as requested: Login to Logout window with hours worked below
          rowData.push(`${inTime} – ${outTime}\n(${formatHoursToClock(hoursNum)})`);
        } else if (inTime) {
          rowData.push(`${inTime} – Active`);
        } else {
          rowData.push(`Present (${formatHoursToClock(hoursNum)})`);
        }
      } else if (status === 'ABSENT') {
        absentCount++;
        rowData.push('ABSENT');
      } else if (status === 'ON_LEAVE') {
        leaveCount++;
        rowData.push('LEAVE');
      } else if (status === 'HOLIDAY') {
        rowData.push('HOLIDAY');
      } else if (status === 'WEEKEND') {
        rowData.push('WEEKEND');
      } else {
        rowData.push(status || '—');
      }
    });

    // Summary columns
    rowData.push(
      presentCount,
      absentCount,
      leaveCount,
      `${formatHoursToClock(totalMonthHours)}\n(${totalMonthHours.toFixed(2)}h)`,
      totalMonthOT > 0 ? `+${formatHoursToClock(totalMonthOT)}` : '0h 00m'
    );

    const addedRow = wsMatrix.addRow(rowData);
    addedRow.height = 36; // Generous height for multiline In - Out and Hours

    const isZebra = empIdx % 2 === 1;
    const baseBg = isZebra ? COLORS.ZEBRA_ROW : COLORS.WHITE;

    addedRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = BORDERS.thin;
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.font = { name: 'Segoe UI', size: 9 };

      // Left align employee details
      if (colNumber === 1) {
        cell.font = { name: 'Segoe UI', size: 9, bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
      } else if (colNumber === 2 || colNumber === 3) {
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
        if (colNumber === 2) cell.font = { name: 'Segoe UI', size: 9.5, bold: true };
      } else if (colNumber > 3 && colNumber <= 3 + sortedDates.length) {
        // Daily Attendance Cells
        const val = String(cell.value || '');
        if (val.includes('–') || val.includes('Present')) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.PRESENT_BG } };
          cell.font = { name: 'Segoe UI', size: 8.5, color: { argb: COLORS.PRESENT_TXT } };
        } else if (val === 'ABSENT') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.ABSENT_BG } };
          cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLORS.ABSENT_TXT } };
        } else if (val === 'LEAVE') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.LEAVE_BG } };
          cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLORS.LEAVE_TXT } };
        } else if (val === 'WEEKEND') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.WEEKEND_BG } };
          cell.font = { name: 'Segoe UI', size: 8.5, color: { argb: COLORS.WEEKEND_TXT } };
        } else if (val === 'HOLIDAY') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.HOLIDAY_BG } };
          cell.font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: COLORS.HOLIDAY_TXT } };
        } else {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
        }
      } else {
        // Summary Columns at the end
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.SUMMARY_BG } };
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.SUMMARY_TXT } };
      }
    });
  });

  // Set explicit column widths for Sheet 1
  wsMatrix.getColumn(1).width = 14; // Employee ID
  wsMatrix.getColumn(2).width = 25; // Employee Name
  wsMatrix.getColumn(3).width = 20; // Department
  for (let i = 0; i < sortedDates.length; i++) {
    wsMatrix.getColumn(4 + i).width = 22; // Each Date column
  }
  const summaryStartCol = 4 + sortedDates.length;
  wsMatrix.getColumn(summaryStartCol).width = 14;     // Present
  wsMatrix.getColumn(summaryStartCol + 1).width = 14; // Absent
  wsMatrix.getColumn(summaryStartCol + 2).width = 14; // Leave
  wsMatrix.getColumn(summaryStartCol + 3).width = 26; // Total Hours Worked (Month)
  wsMatrix.getColumn(summaryStartCol + 4).width = 18; // Total Overtime

  // =========================================================================
  // SHEET 2: Daily Attendance Logs (Row-by-Row Register)
  // =========================================================================
  const wsLogs = workbook.addWorksheet('Daily Attendance Logs', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 4 }],
    properties: { defaultRowHeight: 24 },
  });

  // Title Banner
  wsLogs.mergeCells('A1:G1');
  const logsTitle = wsLogs.getCell('A1');
  logsTitle.value = `${orgName} — Daily Attendance Register`;
  logsTitle.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FF1E3A8A' } };
  logsTitle.alignment = { vertical: 'middle', horizontal: 'left' };
  wsLogs.getRow(1).height = 28;

  wsLogs.mergeCells('A2:G2');
  const logsSub = wsLogs.getCell('A2');
  logsSub.value = `Period: ${periodLabel} | Total Records: ${records.length} | Generated: ${new Date().toLocaleString()}`;
  logsSub.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF64748B' } };
  logsSub.alignment = { vertical: 'middle', horizontal: 'left' };
  wsLogs.getRow(2).height = 20;

  wsLogs.getRow(3).height = 10;

  // Header Row 4
  const logHeaders = [
    '#',
    'Employee ID',
    'Employee Name',
    'Department',
    'Date',
    'Day',
    'Logged In Time',
    'Logged Out Time',
    'Login – Logout Window',
    'Hours Worked (HH:MM)',
    'Hours Worked (Decimal)',
    'Break Duration',
    'Overtime (OT)',
    'Status',
    'Assigned Shift',
    'Adjusted / Regularized',
    'Remarks / Notes',
  ];

  const logHeaderRow = wsLogs.addRow(logHeaders);
  logHeaderRow.height = 26;
  logHeaderRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.NAVY_HEADER },
    };
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.WHITE } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = BORDERS.header;
  });

  // Sort records chronologically
  const sortedRecords = [...records].sort((a, b) => {
    const dComp = (a.attendanceDate || '').localeCompare(b.attendanceDate || '');
    if (dComp !== 0) return dComp;
    const nameA = a.employee?.firstName || a.fullName || '';
    const nameB = b.employee?.firstName || b.fullName || '';
    return nameA.localeCompare(nameB);
  });

  sortedRecords.forEach((rec, idx) => {
    const dStr = getLocalDateString(rec.attendanceDate);
    const displayDate = formatDisplayDate(rec.attendanceDate);
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
    const shift =
      rec.employee?.shiftTiming || rec.shiftTiming || '11:00 AM - 07:00 PM';

    let remarks = '';
    if (rec.notes) remarks += rec.notes;
    if (rec.regularizationReason) {
      remarks += (remarks ? ' | ' : '') + `Adjusted: ${rec.regularizationReason}`;
    }

    const rowVal = [
      idx + 1,
      empCode,
      empName,
      dept,
      displayDate,
      dayOfWeek,
      inTime || '—',
      outTime || (inTime ? 'Active Session' : '—'),
      punchWindow,
      formatHoursToClock(hours),
      hours,
      breakMins > 0 ? `${breakMins} mins` : '0 mins',
      ot > 0 ? `+${formatHoursToClock(ot)}` : '—',
      (rec.status || '').toUpperCase(),
      shift,
      rec.isRegularized ? 'Yes' : 'No',
      remarks || '—',
    ];

    const r = wsLogs.addRow(rowVal);
    r.height = 24;

    const isZebra = idx % 2 === 1;
    const baseBg = isZebra ? COLORS.ZEBRA_ROW : COLORS.WHITE;

    r.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = BORDERS.thin;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.font = { name: 'Segoe UI', size: 9.5 };

      // Alignments & Styles
      if (colNumber === 2 || colNumber === 3) {
        if (colNumber === 3) cell.alignment = { vertical: 'middle', horizontal: 'left' };
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true };
      } else if (colNumber === 10 || colNumber === 11) {
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
      } else if (colNumber === 14) {
        // Status column badge styling
        const st = String(cell.value || '');
        if (st === 'PRESENT') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.PRESENT_BG } };
          cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLORS.PRESENT_TXT } };
        } else if (st === 'ABSENT') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.ABSENT_BG } };
          cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLORS.ABSENT_TXT } };
        } else if (st === 'ON_LEAVE') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.LEAVE_BG } };
          cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLORS.LEAVE_TXT } };
        }
      }
    });
  });

  // Column Widths for Sheet 2
  wsLogs.getColumn(1).width = 6;   // #
  wsLogs.getColumn(2).width = 14;  // Employee ID
  wsLogs.getColumn(3).width = 24;  // Name
  wsLogs.getColumn(4).width = 20;  // Department
  wsLogs.getColumn(5).width = 15;  // Date
  wsLogs.getColumn(6).width = 14;  // Day
  wsLogs.getColumn(7).width = 16;  // Log In Time
  wsLogs.getColumn(8).width = 16;  // Log Out Time
  wsLogs.getColumn(9).width = 26;  // Window
  wsLogs.getColumn(10).width = 22; // Hours Clock
  wsLogs.getColumn(11).width = 20; // Hours Decimal
  wsLogs.getColumn(12).width = 15; // Break
  wsLogs.getColumn(13).width = 15; // OT
  wsLogs.getColumn(14).width = 14; // Status
  wsLogs.getColumn(15).width = 24; // Shift
  wsLogs.getColumn(16).width = 20; // Regularized
  wsLogs.getColumn(17).width = 32; // Remarks

  // Auto-filter on Row 4
  wsLogs.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: logHeaders.length },
  };

  // =========================================================================
  // SHEET 3: Monthly Hours Summary (Per Employee Totals)
  // =========================================================================
  const wsSummary = workbook.addWorksheet('Monthly Hours Summary', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 4 }],
    properties: { defaultRowHeight: 25 },
  });

  wsSummary.mergeCells('A1:G1');
  const sumTitle = wsSummary.getCell('A1');
  sumTitle.value = `${orgName} — Employee Monthly Working Hours Summary`;
  sumTitle.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FF1E3A8A' } };
  sumTitle.alignment = { vertical: 'middle', horizontal: 'left' };
  wsSummary.getRow(1).height = 28;

  wsSummary.mergeCells('A2:G2');
  const sumSub = wsSummary.getCell('A2');
  sumSub.value = `Period: ${periodLabel} | Total Employees: ${employeeList.length} | Generated: ${new Date().toLocaleString()}`;
  sumSub.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF64748B' } };
  sumSub.alignment = { vertical: 'middle', horizontal: 'left' };
  wsSummary.getRow(2).height = 20;

  wsSummary.getRow(3).height = 10;

  const sumHeaders = [
    '#',
    'Employee ID',
    'Employee Name',
    'Department',
    'Designation',
    'Assigned Shift',
    'Period',
    'Days Present',
    'Days Absent',
    'Days Leave',
    'Total Hours Worked (Month)',
    'Total Hours (Decimal)',
    'Total Overtime (Month)',
    'Average Daily Hours',
  ];

  const sumHeaderRow = wsSummary.addRow(sumHeaders);
  sumHeaderRow.height = 26;
  sumHeaderRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.NAVY_HEADER },
    };
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLORS.WHITE } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = BORDERS.header;
  });

  employeeList.forEach((emp, idx) => {
    let totalHours = 0;
    let totalOT = 0;
    let presentDays = 0;
    let absentDays = 0;
    let leaveDays = 0;

    emp.records.forEach((rec) => {
      const h = Number(rec.totalHours || 0);
      const o = Number(rec.overtimeHours || 0);
      totalHours += h;
      totalOT += o;

      const st = (rec.status || '').toUpperCase();
      if (st === 'PRESENT' || st === 'LATE' || st === 'HALF_DAY' || st === 'REGULARIZED') {
        presentCount(st);
        presentDays++;
      } else if (st === 'ABSENT') {
        absentDays++;
      } else if (st === 'ON_LEAVE') {
        leaveDays++;
      }
    });

    function presentCount() {}

    const avgDailyHours =
      presentDays > 0 ? (totalHours / presentDays).toFixed(2) : '0.00';

    const r = wsSummary.addRow([
      idx + 1,
      emp.empCode,
      emp.fullName,
      emp.dept,
      emp.designation,
      emp.shiftTiming,
      periodLabel,
      presentDays,
      absentDays,
      leaveDays,
      formatHoursToClock(totalHours),
      parseFloat(totalHours.toFixed(2)),
      totalOT > 0 ? `+${formatHoursToClock(totalOT)}` : '0h 00m',
      `${avgDailyHours} hrs`,
    ]);

    r.height = 24;
    const isZebra = idx % 2 === 1;
    const baseBg = isZebra ? COLORS.ZEBRA_ROW : COLORS.WHITE;

    r.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = BORDERS.thin;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.font = { name: 'Segoe UI', size: 9.5 };

      if (colNumber === 2 || colNumber === 3) {
        if (colNumber === 3) cell.alignment = { vertical: 'middle', horizontal: 'left' };
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true };
      } else if (colNumber === 11 || colNumber === 12) {
        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1E3A8A' } };
      }
    });
  });

  wsSummary.getColumn(1).width = 6;
  wsSummary.getColumn(2).width = 14;
  wsSummary.getColumn(3).width = 24;
  wsSummary.getColumn(4).width = 20;
  wsSummary.getColumn(5).width = 22;
  wsSummary.getColumn(6).width = 22;
  wsSummary.getColumn(7).width = 26;
  wsSummary.getColumn(8).width = 14;
  wsSummary.getColumn(9).width = 14;
  wsSummary.getColumn(10).width = 14;
  wsSummary.getColumn(11).width = 26;
  wsSummary.getColumn(12).width = 22;
  wsSummary.getColumn(13).width = 22;
  wsSummary.getColumn(14).width = 20;

  wsSummary.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: sumHeaders.length },
  };

  // ==========================================
  // Trigger Browser Download
  // ==========================================
  const buffer = await workbook.xlsx.writeBuffer();
  const cleanOrg = orgName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${cleanOrg}_Attendance_Timesheet_From_Sep_26.xlsx`;

  // Safe browser download
  if (typeof window !== 'undefined' && window.document) {
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
  }

  return {
    fileName,
    recordCount: records.length,
    employeeCount: employeeList.length,
    buffer,
  };
};
