import ExcelJS from 'exceljs';
import { formatHoursToClock } from './timeUtils.js';

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
 * Resolves standard leave short code (CL, PL, SL, ML, PTL, LOP, HDL, AWOL, SBL, EL, COMP)
 * from joined DB leaveCode, leaveName, leaveType, or notes.
 */
export const getLeaveShortCode = (rec) => {
  if (!rec) return 'CL';

  // 1. Direct code from DB lateral join or attached property
  const directCode =
    rec.leaveCode ||
    rec.leave_code ||
    rec.leaveTypeCode ||
    (typeof rec.leaveType === 'string' ? rec.leaveType : rec.leaveType?.code);
  if (directCode && typeof directCode === 'string' && directCode.trim()) {
    const code = directCode.trim().toUpperCase();
    if (code === 'LWP') return 'LOP'; // Standardize Leave Without Pay -> LOP
    if (code === 'PATL') return 'PTL'; // Paternity Leave -> PTL
    return code;
  }

  // 2. Name from DB lateral join or object, plus notes
  const name = (
    rec.leaveName ||
    rec.leave_name ||
    rec.leaveTypeName ||
    rec.leaveType?.name ||
    ''
  ).toUpperCase();
  const notes = (rec.notes || '').toUpperCase();
  const combined = `${name} ${notes}`;

  if (combined.includes('CASUAL') || combined.includes('CL')) return 'CL';
  if (combined.includes('PLANNED') || combined.includes('PRIVILEGE') || combined.includes('ANNUAL') || combined.includes('PL')) return 'PL';
  if (combined.includes('SICK') || combined.includes('MEDICAL') || combined.includes('SL')) return 'SL';
  if (combined.includes('MATERNITY') || combined.includes('ML')) return 'ML';
  if (combined.includes('PATERNITY') || combined.includes('PTL')) return 'PTL';
  if (combined.includes('SABBATICAL') || combined.includes('SBL')) return 'SBL';
  if (combined.includes('HALF DAY') || combined.includes('HALF-DAY') || combined.includes('HDL')) return 'HDL';
  if (combined.includes('AWOL') || combined.includes('WITHOUT LEAVE')) return 'AWOL';
  if (combined.includes('WITHOUT PAY') || combined.includes('LOSS OF PAY') || combined.includes('LOP') || combined.includes('LWP')) return 'LOP';
  if (combined.includes('COMPENSATORY') || combined.includes('COMP OFF') || combined.includes('COMP-OFF') || combined.includes('CO')) return 'COMP';
  if (combined.includes('EMERGENCY') || combined.includes('EL')) return 'EL';
  if (combined.includes('BEREAVEMENT') || combined.includes('BL')) return 'BL';
  if (combined.includes('HOLIDAY') || combined.includes('HL')) return 'HL';

  return 'CL'; // Sensible standard default
};

/**
 * Builds all dates strictly for a single calendar month (Day 1 to Last Day)
 * @param {string} monthKey - "YYYY-MM" e.g. "2026-09"
 */
export const getDatesForSingleMonth = (monthKey) => {
  const [yearStr, monthStr] = (monthKey || '2026-09').split('-');
  const y = parseInt(yearStr, 10);
  const m = parseInt(monthStr, 10); // 1-12
  const daysInMonth = new Date(y, m, 0).getDate();

  const dates = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const dayPadded = String(day).padStart(2, '0');
    const monthPadded = String(m).padStart(2, '0');
    dates.push(`${y}-${monthPadded}-${dayPadded}`);
  }
  return dates;
};

// ==========================================
// Helper: Build Single Monthly Timesheet Worksheet
// ==========================================
const buildMonthlyMatrixWorksheet = (
  workbook,
  targetMonthStr,
  monthRecords,
  orgName,
  customMonthTitle = null
) => {
  const sortedDates = getDatesForSingleMonth(targetMonthStr);
  const [yStr, mStr] = targetMonthStr.split('-');
  const monthObj = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, 1);
  const cleanMonthTitle =
    customMonthTitle ||
    monthObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Group records by employee
  const employeeMap = new Map();
  monthRecords.forEach((rec) => {
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

  const sheetName = `${cleanMonthTitle} Timesheet`.substring(0, 31);
  const wsMatrix = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', xSplit: 3, ySplit: 5 }],
    properties: { defaultRowHeight: 28 },
  });

  // 1. Title Banner (Rows 1 & 2)
  wsMatrix.mergeCells('A1:I1');
  const titleCell = wsMatrix.getCell('A1');
  titleCell.value = `${orgName} — Monthly Attendance Timesheet (${cleanMonthTitle})`;
  titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FF1E3A8A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  wsMatrix.getRow(1).height = 28;

  wsMatrix.mergeCells('A2:I2');
  const subTitleCell = wsMatrix.getCell('A2');
  subTitleCell.value = `Month: ${cleanMonthTitle} (01 to ${sortedDates.length} ${cleanMonthTitle.split(' ')[0]}) | Total Employees: ${employeeList.length} | Leave Codes: CL (Casual), PL (Planned), SL (Sick), ML (Maternity), PTL (Paternity), LOP (Loss of Pay), SBL (Sabbatical) | Generated: ${new Date().toLocaleString()}`;
  subTitleCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF64748B' } };
  subTitleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  wsMatrix.getRow(2).height = 20;

  wsMatrix.getRow(3).height = 10; // blank separator

  // 2. Header Row 4: Date
  const row4Values = ['Employee ID', 'Employee Name', 'Department'];
  // 3. Header Row 5: Day of Week
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
    `Total Hours (${cleanMonthTitle})`,
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

  // 4. Populate Employee Data Rows
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
          rowData.push(`${inTime} – ${outTime}\n(${formatHoursToClock(hoursNum)})`);
        } else if (inTime) {
          rowData.push(`${inTime} – Active`);
        } else {
          rowData.push(`Present (${formatHoursToClock(hoursNum)})`);
        }
      } else if (status === 'ABSENT') {
        absentCount++;
        rowData.push('ABSENT');
      } else if (status === 'NOT_STARTED' || status === 'YET_TO_CHECK_IN') {
        rowData.push('Shift Not Started');
      } else if (status === 'ON_LEAVE') {
        leaveCount++;
        const lCode = getLeaveShortCode(rec);
        rowData.push(`LEAVE (${lCode})`);
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
    addedRow.height = 36;

    const isZebra = empIdx % 2 === 1;
    const baseBg = isZebra ? COLORS.ZEBRA_ROW : COLORS.WHITE;

    addedRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = BORDERS.thin;
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.font = { name: 'Segoe UI', size: 9 };

      if (colNumber === 1) {
        cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF334155' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
      } else if (colNumber === 2) {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
      } else if (colNumber === 3) {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF475569' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
      } else if (colNumber <= 3 + sortedDates.length) {
        // Daily attendance cell
        const val = String(cell.value || '');
        if (val.includes('–') || val.startsWith('Present')) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.PRESENT_BG } };
          cell.font = { name: 'Segoe UI', size: 8.5, color: { argb: COLORS.PRESENT_TXT } };
        } else if (val === 'ABSENT') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.ABSENT_BG } };
          cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLORS.ABSENT_TXT } };
        } else if (val === 'Shift Not Started') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.WEEKEND_BG } };
          cell.font = { name: 'Segoe UI', size: 8.5, italic: true, color: { argb: COLORS.WEEKEND_TXT } };
        } else if (val.startsWith('LEAVE') || val === 'LEAVE') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.LEAVE_BG } };
          cell.font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: COLORS.LEAVE_TXT } };
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
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.SUMMARY_BG } };
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.SUMMARY_TXT } };
      }
    });
  });

  // Set column widths
  wsMatrix.getColumn(1).width = 14;
  wsMatrix.getColumn(2).width = 25;
  wsMatrix.getColumn(3).width = 20;
  for (let i = 0; i < sortedDates.length; i++) {
    wsMatrix.getColumn(4 + i).width = 22;
  }
  const summaryStartCol = 4 + sortedDates.length;
  wsMatrix.getColumn(summaryStartCol).width = 14;
  wsMatrix.getColumn(summaryStartCol + 1).width = 14;
  wsMatrix.getColumn(summaryStartCol + 2).width = 14;
  wsMatrix.getColumn(summaryStartCol + 3).width = 28;
  wsMatrix.getColumn(summaryStartCol + 4).width = 18;

  return { employeeList, cleanMonthTitle };
};

// ==========================================
// Helper: Build Daily Attendance Logs Worksheet
// ==========================================
const buildDailyLogsWorksheet = (workbook, exportRecords, cleanMonthTitle, orgName) => {
  const wsLogs = workbook.addWorksheet('Daily Attendance Logs', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 4 }],
    properties: { defaultRowHeight: 24 },
  });

  wsLogs.mergeCells('A1:G1');
  const logsTitle = wsLogs.getCell('A1');
  logsTitle.value = `${orgName} — Daily Attendance Register (${cleanMonthTitle})`;
  logsTitle.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FF1E3A8A' } };
  logsTitle.alignment = { vertical: 'middle', horizontal: 'left' };
  wsLogs.getRow(1).height = 28;

  wsLogs.mergeCells('A2:G2');
  const logsSub = wsLogs.getCell('A2');
  logsSub.value = `Report Scope: ${cleanMonthTitle} | Total Records: ${exportRecords.length} | Generated: ${new Date().toLocaleString()}`;
  logsSub.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF64748B' } };
  logsSub.alignment = { vertical: 'middle', horizontal: 'left' };
  wsLogs.getRow(2).height = 20;

  wsLogs.getRow(3).height = 10;

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
    'Attendance Status',
    'Shift Assigned',
    'Is Regularized',
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

  const sortedLogs = [...exportRecords].sort((a, b) => {
    const da = new Date(a.attendanceDate || 0);
    const db = new Date(b.attendanceDate || 0);
    if (da - db !== 0) return da - db;
    const na = (a.employee?.firstName || a.fullName || '').toLowerCase();
    const nb = (b.employee?.firstName || b.fullName || '').toLowerCase();
    return na.localeCompare(nb);
  });

  sortedLogs.forEach((rec, idx) => {
    const d = new Date(rec.attendanceDate);
    const displayDate = formatDisplayDate(d);
    const dayOfWeek = getDayOfWeek(d, 'short');
    const inTime = formatTime12h(rec.checkIn);
    const outTime = formatTime12h(rec.checkOut);
    const hours = Number(rec.totalHours || 0);
    const ot = Number(rec.overtimeHours || 0);
    const breakMins = rec.breakDurationMinutes || 0;

    let punchWindow = '—';
    if (inTime && outTime) {
      punchWindow = `${inTime} – ${outTime}`;
    } else if (inTime) {
      punchWindow = `${inTime} – Active (Working)`;
    }

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

    const isLeave = (rec.status || '').toUpperCase() === 'ON_LEAVE';
    const isNotStarted = (rec.status || '').toUpperCase() === 'NOT_STARTED' || (rec.status || '').toUpperCase() === 'YET_TO_CHECK_IN';
    const lCode = isLeave ? getLeaveShortCode(rec) : null;
    const statusDisplay = isLeave
      ? `ON_LEAVE (${lCode})`
      : isNotStarted
      ? 'SHIFT_NOT_STARTED'
      : (rec.status || '').toUpperCase();

    let remarks = '';
    if (rec.notes) remarks += rec.notes;
    if (isLeave && rec.leaveName && !remarks.includes(rec.leaveName)) {
      remarks = remarks ? `${remarks} | Leave: ${rec.leaveName}` : `Leave: ${rec.leaveName}`;
    }
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
      statusDisplay,
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

      if (colNumber === 2 || colNumber === 3) {
        if (colNumber === 3) cell.alignment = { vertical: 'middle', horizontal: 'left' };
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true };
      } else if (colNumber === 10 || colNumber === 11) {
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
      } else if (colNumber === 14) {
        const st = String(cell.value || '');
        if (st === 'PRESENT') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.PRESENT_BG } };
          cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLORS.PRESENT_TXT } };
        } else if (st === 'ABSENT') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.ABSENT_BG } };
          cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLORS.ABSENT_TXT } };
        } else if (st.startsWith('ON_LEAVE') || st === 'LEAVE') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.LEAVE_BG } };
          cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLORS.LEAVE_TXT } };
        } else if (st === 'SHIFT_NOT_STARTED' || st === 'NOT_STARTED') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.WEEKEND_BG } };
          cell.font = { name: 'Segoe UI', size: 8.5, italic: true, color: { argb: COLORS.WEEKEND_TXT } };
        }
      }
    });
  });

  wsLogs.getColumn(1).width = 6;
  wsLogs.getColumn(2).width = 14;
  wsLogs.getColumn(3).width = 24;
  wsLogs.getColumn(4).width = 20;
  wsLogs.getColumn(5).width = 15;
  wsLogs.getColumn(6).width = 14;
  wsLogs.getColumn(7).width = 16;
  wsLogs.getColumn(8).width = 16;
  wsLogs.getColumn(9).width = 26;
  wsLogs.getColumn(10).width = 22;
  wsLogs.getColumn(11).width = 20;
  wsLogs.getColumn(12).width = 15;
  wsLogs.getColumn(13).width = 15;
  wsLogs.getColumn(14).width = 18;
  wsLogs.getColumn(15).width = 24;
  wsLogs.getColumn(16).width = 20;
  wsLogs.getColumn(17).width = 32;

  wsLogs.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: logHeaders.length },
  };
};

// ==========================================
// Helper: Build Employee Hours Summary Worksheet
// ==========================================
const buildMonthlySummaryWorksheet = (workbook, exportRecords, cleanMonthTitle, orgName) => {
  const wsSummary = workbook.addWorksheet('Monthly Hours Summary', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 4 }],
    properties: { defaultRowHeight: 25 },
  });

  // Group by employee
  const employeeMap = new Map();
  exportRecords.forEach((rec) => {
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
        records: [],
      });
    }
    employeeMap.get(empId).records.push(rec);
  });

  const employeeList = Array.from(employeeMap.values()).sort((a, b) =>
    a.fullName.localeCompare(b.fullName)
  );

  wsSummary.mergeCells('A1:G1');
  const sumTitle = wsSummary.getCell('A1');
  sumTitle.value = `${orgName} — Employee Working Hours Summary (${cleanMonthTitle})`;
  sumTitle.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FF1E3A8A' } };
  sumTitle.alignment = { vertical: 'middle', horizontal: 'left' };
  wsSummary.getRow(1).height = 28;

  wsSummary.mergeCells('A2:G2');
  const sumSub = wsSummary.getCell('A2');
  sumSub.value = `Scope: ${cleanMonthTitle} | Total Employees: ${employeeList.length} | Generated: ${new Date().toLocaleString()}`;
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
    'Report Scope',
    'Days Present',
    'Days Absent',
    'Days Leave',
    'Leave Breakdown (CL/PL/SL)',
    `Total Hours Worked (${cleanMonthTitle})`,
    'Total Hours (Decimal)',
    'Total Overtime (OT)',
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
    const leaveBreakdown = {};

    emp.records.forEach((rec) => {
      const h = Number(rec.totalHours || 0);
      const o = Number(rec.overtimeHours || 0);
      totalHours += h;
      totalOT += o;

      const st = (rec.status || '').toUpperCase();
      if (st === 'PRESENT' || st === 'LATE' || st === 'HALF_DAY' || st === 'REGULARIZED') {
        presentDays++;
      } else if (st === 'ABSENT') {
        absentDays++;
      } else if (st === 'ON_LEAVE') {
        leaveDays++;
        const lCode = getLeaveShortCode(rec);
        leaveBreakdown[lCode] = (leaveBreakdown[lCode] || 0) + 1;
      }
    });

    const leaveBreakdownStr =
      Object.entries(leaveBreakdown)
        .map(([code, count]) => `${count} ${code}`)
        .join(', ') || (leaveDays > 0 ? `${leaveDays} Leave` : '—');

    const avgDailyHours =
      presentDays > 0 ? (totalHours / presentDays).toFixed(2) : '0.00';

    const r = wsSummary.addRow([
      idx + 1,
      emp.empCode,
      emp.fullName,
      emp.dept,
      emp.designation,
      emp.shiftTiming,
      cleanMonthTitle,
      presentDays,
      absentDays,
      leaveDays,
      leaveBreakdownStr,
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
      } else if (colNumber === 12 || colNumber === 13) {
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
  wsSummary.getColumn(7).width = 22;
  wsSummary.getColumn(8).width = 14;
  wsSummary.getColumn(9).width = 14;
  wsSummary.getColumn(10).width = 14;
  wsSummary.getColumn(11).width = 26;
  wsSummary.getColumn(12).width = 26;
  wsSummary.getColumn(13).width = 22;
  wsSummary.getColumn(14).width = 20;
  wsSummary.getColumn(15).width = 18;

  wsSummary.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: sumHeaders.length },
  };

  return { employeeCount: employeeList.length };
};

// ==========================================
// Helper: Trigger Browser Download
// ==========================================
const downloadWorkbook = async (workbook, cleanMonthTitle, recordCount, employeeCount, orgName) => {
  const buffer = await workbook.xlsx.writeBuffer();
  const cleanOrg = orgName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanMonth = cleanMonthTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${cleanOrg}_Attendance_Report_${cleanMonth}.xlsx`;

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
    recordCount,
    employeeCount,
    month: cleanMonthTitle,
    buffer,
  };
};

/**
 * Main export function supporting Single-Month and ALL MONTHS selection
 */
export const exportAttendanceToExcel = async (records = [], options = {}) => {
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('No attendance records found for this period to export.');
  }

  const {
    filters = {},
    month = '',
    monthLabel = '',
    orgName = 'TaskNera HRMS',
  } = options;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'TaskNera HRMS';
  workbook.created = new Date();

  const isAllMonths = month === 'all';

  if (isAllMonths) {
    // 1. Identify all distinct months present in the dataset
    const distinctMonths = [
      ...new Set(
        records
          .map((r) => {
            const dStr = getLocalDateString(r.attendanceDate);
            return dStr && /^\d{4}-\d{2}/.test(dStr) ? dStr.substring(0, 7) : null;
          })
          .filter(Boolean)
      ),
    ].sort();

    if (distinctMonths.length === 0) {
      distinctMonths.push('2026-09');
    }

    // 2. Generate a dedicated monthly timesheet tab for each month
    distinctMonths.forEach((mStr) => {
      const monthRecs = records.filter((r) => {
        const dStr = getLocalDateString(r.attendanceDate);
        return dStr && dStr.startsWith(mStr);
      });
      if (monthRecs.length > 0) {
        buildMonthlyMatrixWorksheet(workbook, mStr, monthRecs, orgName);
      }
    });

    // 3. Generate consolidated Daily Attendance Register across all months
    buildDailyLogsWorksheet(workbook, records, 'All Months', orgName);

    // 4. Generate Employee Working Hours Summary across all months
    const summaryResult = buildMonthlySummaryWorksheet(workbook, records, 'All Months', orgName);

    // 5. Download workbook
    return downloadWorkbook(workbook, 'All_Months', records.length, summaryResult.employeeCount, orgName);
  } else {
    // Single Month Mode
    let targetMonth = month;
    if (!targetMonth && filters.startDate) {
      targetMonth = filters.startDate.substring(0, 7);
    }
    if (!targetMonth && records[0]?.attendanceDate) {
      targetMonth = getLocalDateString(records[0].attendanceDate).substring(0, 7);
    }
    if (!targetMonth) {
      targetMonth = '2026-09';
    }

    // Strictly filter records for this target month only
    const monthRecords = records.filter((r) => {
      const dStr = getLocalDateString(r.attendanceDate);
      return dStr && dStr.startsWith(targetMonth);
    });

    if (monthRecords.length === 0) {
      throw new Error(`No attendance records found for ${targetMonth}.`);
    }

    const [yStr, mStr] = targetMonth.split('-');
    const monthObj = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, 1);
    const cleanMonthTitle =
      monthLabel ||
      monthObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    buildMonthlyMatrixWorksheet(workbook, targetMonth, monthRecords, orgName, cleanMonthTitle);
    buildDailyLogsWorksheet(workbook, monthRecords, cleanMonthTitle, orgName);
    const summaryResult = buildMonthlySummaryWorksheet(workbook, monthRecords, cleanMonthTitle, orgName);

    return downloadWorkbook(workbook, cleanMonthTitle, monthRecords.length, summaryResult.employeeCount, orgName);
  }
};
