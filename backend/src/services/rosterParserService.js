import XLSX from 'xlsx';
import { nanoid } from 'nanoid';

/**
 * Roster Parser Service
 * Parses Excel/CSV roster files with layout:
 * - Column A: Employee Name
 * - Column B: Designation
 * - Columns C onward: Calendar days numbered 1, 2, 3, 4 ... 31
 * - Row immediately below: Weekday labels (Sat, Sun, Mon, Tue, Wed, Thu, Fri)
 * - Final column: Working Days
 */
class RosterParserService {
  /**
   * Month names lookup map
   */
  MONTH_NAMES = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];

  MONTH_ABBRS = [
    'jan', 'feb', 'mar', 'apr', 'may', 'jun',
    'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
  ];

  /**
   * Parse Excel or CSV file buffer
   * @param {Buffer} fileBuffer - File buffer
   * @param {String} filename - Original filename
   * @param {Number} selectedMonth - Month (1-12)
   * @param {Number} selectedYear - Year (e.g. 2026)
   * @returns {Object} Parsed roster data
   */
  parseRosterFile(fileBuffer, filename, selectedMonth, selectedYear) {
    try {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: false, cellText: true });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert to 2D array
      const data = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        raw: false,
        defval: '',
        blankrows: false
      });

      if (!data || data.length < 3) {
        throw new Error('Invalid roster file: Insufficient rows. Expected at least day header + weekday row + employee data rows.');
      }

      // Try detecting month & year from workbook metadata or sheet name or filename
      const detectedDate = this.detectMonthAndYear(workbook, sheetName, filename, data);

      return this.parseRosterData(data, selectedMonth, selectedYear, filename, detectedDate);
    } catch (err) {
      throw new Error(`Failed to parse roster file: ${err.message}`);
    }
  }

  /**
   * Attempt to detect month and year from workbook sheet names, top rows, or filename
   */
  detectMonthAndYear(workbook, sheetName, filename, data) {
    let detectedMonth = null;
    let detectedYear = null;

    // Search targets in order of specificity
    const targets = [
      sheetName,
      filename,
      ...(data.slice(0, 5).map(row => Array.isArray(row) ? row.join(' ') : ''))
    ];

    for (const target of targets) {
      if (!target || typeof target !== 'string') continue;
      const lower = target.toLowerCase();

      // Check year (2020-2035)
      if (!detectedYear) {
        const yearMatch = lower.match(/\b(202[0-9]|203[0-5])\b/);
        if (yearMatch) {
          detectedYear = parseInt(yearMatch[1], 10);
        }
      }

      // Check full month names
      if (!detectedMonth) {
        for (let m = 0; m < this.MONTH_NAMES.length; m++) {
          const monthName = this.MONTH_NAMES[m];
          const regex = new RegExp(`\\b${monthName}\\b`, 'i');
          if (regex.test(lower)) {
            detectedMonth = m + 1;
            break;
          }
        }
      }

      // Check abbreviated month names
      if (!detectedMonth) {
        for (let m = 0; m < this.MONTH_ABBRS.length; m++) {
          const abbr = this.MONTH_ABBRS[m];
          const regex = new RegExp(`\\b${abbr}[-_\\s0-9]`, 'i');
          if (regex.test(lower)) {
            detectedMonth = m + 1;
            break;
          }
        }
      }

      if (detectedMonth && detectedYear) break;
    }

    return { detectedMonth, detectedYear };
  }

  /**
   * Parse 2D array roster data
   */
  parseRosterData(data, selectedMonth, selectedYear, filename, detectedDate = {}) {
    const warnings = [];
    const errors = [];

    // Consistency check on detected month/year
    if (detectedDate.detectedMonth && detectedDate.detectedMonth !== selectedMonth) {
      warnings.push(
        `Workbook appears to be for ${this.getMonthName(detectedDate.detectedMonth)}, but ${this.getMonthName(selectedMonth)} was selected.`
      );
    }
    if (detectedDate.detectedYear && detectedDate.detectedYear !== selectedYear) {
      warnings.push(
        `Workbook appears to be for year ${detectedDate.detectedYear}, but year ${selectedYear} was selected.`
      );
    }

    // Find header row containing sequential day numbers (1, 2, 3...)
    let headerRowIndex = -1;
    let dayStartColIndex = 2; // Default column C (index 2)

    for (let i = 0; i < Math.min(15, data.length); i++) {
      const row = data[i];
      if (!row || row.length < 5) continue;

      const headerInfo = this.findDaySequenceInRow(row);
      if (headerInfo.found) {
        headerRowIndex = i;
        dayStartColIndex = headerInfo.startCol;
        break;
      }
    }

    if (headerRowIndex === -1) {
      throw new Error(
        'Could not locate the header row containing calendar day numbers (1, 2, 3...). Please verify the roster spreadsheet layout.'
      );
    }

    const headerRow = data[headerRowIndex];

    // Weekday row is expected immediately below the day numbers row
    let weekdayRowIndex = headerRowIndex + 1 < data.length ? headerRowIndex + 1 : -1;
    let weekdayRow = weekdayRowIndex >= 0 ? data[weekdayRowIndex] : null;

    // Verify if weekdayRow actually contains weekday labels (Sat, Sun, Mon, etc.)
    if (weekdayRow) {
      const hasWeekdayLabels = this.isWeekdayRow(weekdayRow, dayStartColIndex);
      if (!hasWeekdayLabels) {
        // Not a weekday row, so data begins immediately on the next row
        weekdayRowIndex = -1;
        weekdayRow = null;
      }
    }

    // Calculate actual days in the selected month & year (accounting for leap years)
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

    // Parse day columns
    const dayColumns = this.parseDayColumns(
      headerRow,
      weekdayRow,
      dayStartColIndex,
      selectedMonth,
      selectedYear,
      daysInMonth,
      warnings
    );

    if (dayColumns.length === 0) {
      throw new Error(`No valid day columns (1 to ${daysInMonth}) found in the header row.`);
    }

    // Find "Working Days" column
    const workingDaysColIndex = this.findWorkingDaysColumn(headerRow);

    // Data rows start after weekday row (or header row if no weekday row)
    const dataStartRow = weekdayRowIndex >= 0 ? weekdayRowIndex + 1 : headerRowIndex + 1;
    const employees = [];

    for (let i = dataStartRow; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 2) continue;

      const employeeName = this.cleanString(row[0]);
      const designation = this.cleanString(row[1]);

      // Skip empty or summary rows (e.g. "Total", "Grand Total")
      if (!employeeName || employeeName.length < 2) continue;
      const lowerName = employeeName.toLowerCase();
      if (lowerName === 'total' || lowerName === 'grand total' || lowerName.startsWith('average')) continue;

      const dailyAssignments = [];
      let workingDaysCount = 0;

      // Parse each day column
      for (const dayCol of dayColumns) {
        const rawCell = row[dayCol.columnIndex];
        const cellValue = this.cleanString(rawCell);
        const parsed = this.parseShiftCell(cellValue, dayCol.date, employeeName);

        dailyAssignments.push({
          date: dayCol.date,
          dayOfMonth: dayCol.dayNumber,
          weekday: dayCol.weekday,
          originalValue: cellValue,
          ...parsed
        });

        // Count working days (only valid working shifts count towards working days)
        if (parsed.shiftType === 'SHIFT' && parsed.isValid) {
          workingDaysCount++;
        }
      }

      // Read declared working days from the designated column if present
      let declaredWorkingDays = 0;
      if (workingDaysColIndex >= 0 && row[workingDaysColIndex] !== undefined) {
        const cleanVal = this.cleanString(row[workingDaysColIndex]);
        const parsedVal = parseInt(cleanVal, 10);
        if (!isNaN(parsedVal) && parsedVal >= 0) {
          declaredWorkingDays = parsedVal;
        }
      }

      const hasWorkingDaysDiscrepancy =
        declaredWorkingDays > 0 && workingDaysCount !== declaredWorkingDays;

      employees.push({
        id: nanoid(),
        rosterEmployeeName: employeeName,
        designation,
        dailyAssignments,
        calculatedWorkingDays: workingDaysCount,
        declaredWorkingDays,
        hasWorkingDaysDiscrepancy,
        rowIndex: i + 1 // 1-indexed Excel row
      });
    }

    return {
      filename,
      selectedMonth,
      selectedYear,
      detectedMonth: detectedDate.detectedMonth || null,
      detectedYear: detectedDate.detectedYear || null,
      daysInMonth: dayColumns.length,
      headerRowIndex: headerRowIndex + 1,
      weekdayRowIndex: weekdayRowIndex >= 0 ? weekdayRowIndex + 1 : null,
      totalEmployees: employees.length,
      employees,
      dayColumns,
      warnings: warnings.length > 0 ? warnings : [],
      errors: errors.length > 0 ? errors : null,
      parsedAt: new Date().toISOString()
    };
  }

  /**
   * Find where day numbers (1, 2, 3...) start in a row
   */
  findDaySequenceInRow(row) {
    for (let c = 1; c < Math.min(row.length, 6); c++) {
      let sequential = 0;
      for (let offset = 0; offset < 5; offset++) {
        const colIdx = c + offset;
        if (colIdx >= row.length) break;
        const val = this.cleanString(row[colIdx]);
        const num = parseInt(val, 10);
        if (num === offset + 1) {
          sequential++;
        }
      }
      if (sequential >= 3) {
        return { found: true, startCol: c };
      }
    }
    return { found: false, startCol: -1 };
  }

  /**
   * Check if a row contains weekday labels (Mon, Tue, Wed, Thu, Fri, Sat, Sun)
   */
  isWeekdayRow(row, startCol) {
    if (!row) return false;
    const weekdayRegex = /^(mon|tue|wed|thu|fri|sat|sun)/i;
    let matchCount = 0;
    for (let c = startCol; c < Math.min(row.length, startCol + 7); c++) {
      const val = this.cleanString(row[c]);
      if (weekdayRegex.test(val)) {
        matchCount++;
      }
    }
    return matchCount >= 3;
  }

  /**
   * Parse day columns from header row and validate against calendar
   */
  parseDayColumns(
    headerRow,
    weekdayRow,
    dayStartColIndex,
    month,
    year,
    daysInMonth,
    warnings
  ) {
    const dayColumns = [];
    let weekdayMismatches = 0;

    for (let i = dayStartColIndex; i < headerRow.length; i++) {
      const cellValue = this.cleanString(headerRow[i]);
      const dayNum = parseInt(cellValue, 10);

      // Check if valid calendar day
      if (!isNaN(dayNum) && dayNum >= 1 && dayNum <= 31) {
        if (dayNum <= daysInMonth) {
          // Construct actual calendar date YYYY-MM-DD
          const monthStr = String(month).padStart(2, '0');
          const dayStr = String(dayNum).padStart(2, '0');
          const dateStr = `${year}-${monthStr}-${dayStr}`;

          // Actual calendar weekday (0=Sun, 1=Mon, ..., 6=Sat)
          const actualDate = new Date(year, month - 1, dayNum);
          const actualWeekday = this.getWeekdayName(actualDate.getDay());

          // File's declared weekday (consistency check)
          let fileWeekday = null;
          if (weekdayRow && weekdayRow[i]) {
            fileWeekday = this.cleanString(weekdayRow[i]);
            if (fileWeekday && !actualWeekday.toLowerCase().startsWith(fileWeekday.toLowerCase().slice(0, 3))) {
              weekdayMismatches++;
            }
          }

          dayColumns.push({
            columnIndex: i,
            dayNumber: dayNum,
            date: dateStr,
            weekday: actualWeekday,
            fileWeekday: fileWeekday || actualWeekday
          });
        } else {
          // Column exceeds days in month (e.g. Day 29/30/31 in Feb, or Day 31 in April)
          warnings.push(
            `Day ${dayNum} in spreadsheet ignored: ${this.getMonthName(month)} ${year} only has ${daysInMonth} days.`
          );
        }
      } else if (dayColumns.length > 0) {
        // End of day columns
        break;
      }
    }

    if (weekdayMismatches >= 3) {
      warnings.push(
        `Weekday labels in file do not match the calendar for ${this.getMonthName(month)} ${year}. Please ensure the correct month and year are selected.`
      );
    }

    return dayColumns;
  }

  /**
   * Find "Working Days" column index
   */
  findWorkingDaysColumn(headerRow) {
    for (let i = headerRow.length - 1; i >= 0; i--) {
      const val = this.cleanString(headerRow[i]).toLowerCase();
      if ((val.includes('working') || val.includes('work')) && val.includes('day')) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Parse individual shift cell value
   * Supports: "11 - 8 PM", "2-8PM", "12 - 6 PM", "1 - 7 PM", "5 - 11 PM", "11 - 5 PM",
   * "WO", "CL", "HD", "NA", blank / empty
   */
  parseShiftCell(cellValue, date, employeeName) {
    const cleaned = cellValue ? cellValue.trim() : '';

    // Handle blank / empty cells
    if (!cleaned) {
      return {
        shiftType: 'BLANK',
        shiftStartTime: null,
        shiftEndTime: null,
        shiftLabel: null,
        isValid: true,
        isOvernight: false,
        error: null
      };
    }

    const upper = cleaned.toUpperCase();

    // Roster status and leave codes: WO, OFF, CL, PL, SL, HD, HDL, LOP, LWP, ML, PTL, SBL, AWOL, HL, HOLIDAY, NA, CO, EL, AL
    const recognizedCodes = [
      'WO', 'OFF', 'CL', 'PL', 'SL', 'HD', 'HDL', 'LOP', 'LWP',
      'ML', 'PTL', 'SBL', 'AWOL', 'HL', 'HOLIDAY', 'NA', 'CO', 'EL', 'AL'
    ];

    if (recognizedCodes.includes(upper)) {
      let normalizedType = upper;
      if (upper === 'OFF') normalizedType = 'WO';
      else if (upper === 'HDL') normalizedType = 'HD';
      else if (upper === 'LWP') normalizedType = 'LOP';
      else if (upper === 'HOLIDAY') normalizedType = 'HL';
      else if (upper === 'EL' || upper === 'AL') normalizedType = 'PL';

      return {
        shiftType: normalizedType,
        shiftStartTime: null,
        shiftEndTime: null,
        shiftLabel: upper,
        isValid: true,
        isOvernight: false,
        error: null
      };
    }

    // Parse shift time range
    return this.parseShiftTime(cleaned, date, employeeName);
  }

  /**
   * Parse shift time patterns and normalize start/end times
   * Handles:
   * - "11 - 8 PM" => 11:00 AM - 08:00 PM (11:00:00 to 20:00:00)
   * - "2 - 8 PM"  => 02:00 PM - 08:00 PM (14:00:00 to 20:00:00)
   * - "12 - 6 PM" => 12:00 PM - 06:00 PM (12:00:00 to 18:00:00)
   * - "1 - 7 PM"  => 01:00 PM - 07:00 PM (13:00:00 to 19:00:00)
   * - "5 - 11 PM" => 05:00 PM - 11:00 PM (17:00:00 to 23:00:00)
   * - "11 - 5 PM" => 11:00 AM - 05:00 PM (11:00:00 to 17:00:00)
   * - "10 PM - 6 AM" => 10:00 PM - 06:00 AM (22:00:00 to 06:00:00 overnight)
   * - "11:00 AM - 07:00 PM"
   */
  parseShiftTime(value, date, employeeName) {
    const cleaned = value.trim();

    // Regex matching time range with optional minutes and optional AM/PM on start or end
    // Supports separator: -, –, —, to
    const pattern = /^(\d{1,2}(?::\d{2})?)\s*(AM|PM)?\s*[-–—to]+\s*(\d{1,2}(?::\d{2})?)\s*(AM|PM)?$/i;
    const match = cleaned.match(pattern);

    if (!match) {
      return {
        shiftType: 'INVALID',
        shiftStartTime: null,
        shiftEndTime: null,
        shiftLabel: value,
        isValid: false,
        isOvernight: false,
        error: `Unrecognized shift format: "${value}". Expected format like "11 - 8 PM", "2-8PM", "WO", etc.`
      };
    }

    const startRaw = match[1];
    let startPeriod = match[2] ? match[2].toUpperCase() : null;
    const endRaw = match[3];
    let endPeriod = match[4] ? match[4].toUpperCase() : null;

    // Parse hour and minute for start
    const [startHStr, startMStr] = startRaw.split(':');
    const startHour = parseInt(startHStr, 10);
    const startMinute = startMStr ? parseInt(startMStr, 10) : 0;

    // Parse hour and minute for end
    const [endHStr, endMStr] = endRaw.split(':');
    const endHour = parseInt(endHStr, 10);
    const endMinute = endMStr ? parseInt(endMStr, 10) : 0;

    if (
      isNaN(startHour) || startHour < 1 || startHour > 12 ||
      isNaN(endHour) || endHour < 1 || endHour > 12 ||
      startMinute < 0 || startMinute > 59 ||
      endMinute < 0 || endMinute > 59
    ) {
      return {
        shiftType: 'INVALID',
        shiftStartTime: null,
        shiftEndTime: null,
        shiftLabel: value,
        isValid: false,
        isOvernight: false,
        error: `Invalid hours or minutes in shift: "${value}". Hours must be 1-12.`
      };
    }

    // Determine AM/PM
    let isOvernight = false;

    if (startPeriod && endPeriod) {
      // Both periods explicitly given
      const start24 = this.to24Hour(startHour, startPeriod);
      const end24 = this.to24Hour(endHour, endPeriod);
      const startMins = start24 * 60 + startMinute;
      const endMins = end24 * 60 + endMinute;

      if (endMins <= startMins) {
        isOvernight = true;
      }
    } else if (endPeriod && !startPeriod) {
      // Only end period given (the most common roster format: e.g. "11 - 8 PM", "2 - 8 PM")
      if (endPeriod === 'PM') {
        if (startHour === 12) {
          // 12 is 12 PM (noon)
          startPeriod = 'PM';
        } else if (endHour === 12) {
          // End is 12 PM (noon) -> start is morning AM
          startPeriod = 'AM';
        } else {
          // Compare Option A (Start is AM) vs Option B (Start is PM)
          // Option A: AM -> PM
          const durA = (endHour + 12) - startHour + (endMinute - startMinute) / 60;
          // Option B: PM -> PM (if startHour < endHour)
          const durB = endHour > startHour
            ? (endHour - startHour) + (endMinute - startMinute) / 60
            : -1;

          // Standard work shift is typically 4 to 10 hours
          if (durB >= 3.5 && durB <= 10) {
            // Afternoon/Evening PM shift: e.g. 1-7 PM (6h), 2-8 PM (6h), 5-11 PM (6h)
            startPeriod = 'PM';
          } else if (durA >= 4 && durA <= 12) {
            // Day shift starting AM: e.g. 11-8 PM (9h), 11-5 PM (6h), 10-6 PM (8h), 9-5 PM (8h)
            startPeriod = 'AM';
          } else {
            // Default to AM start if startHour >= 6, else PM
            startPeriod = startHour >= 6 ? 'AM' : 'PM';
          }
        }
      } else {
        // End is AM: likely an overnight shift (e.g. "10 - 6 AM", "11 - 7 AM")
        if (startHour >= 6 && startHour <= 12) {
          startPeriod = 'PM';
          isOvernight = true;
        } else {
          startPeriod = 'AM';
        }
      }
    } else if (startPeriod && !endPeriod) {
      // Only start period given: e.g. "9 AM - 5" -> end follows or is PM
      if (startPeriod === 'AM') {
        endPeriod = endHour < startHour || endHour >= 12 ? 'PM' : 'AM';
      } else {
        endPeriod = endHour < startHour ? 'AM' : 'PM';
        if (endPeriod === 'AM') isOvernight = true;
      }
    } else {
      // Neither AM nor PM given: make smart standard assumption (typical work shift)
      if (startHour >= 8 && startHour <= 12 && endHour >= 1 && endHour <= 9) {
        startPeriod = 'AM';
        endPeriod = 'PM';
      } else if (startHour < endHour) {
        startPeriod = 'AM';
        endPeriod = 'AM';
      } else {
        startPeriod = 'PM';
        endPeriod = 'AM';
        isOvernight = true;
      }
    }

    const start24 = this.to24Hour(startHour, startPeriod);
    const end24 = this.to24Hour(endHour, endPeriod);

    if (end24 < start24 && !isOvernight) {
      isOvernight = true;
    }

    const startTime = `${String(start24).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}:00`;
    const endTime = `${String(end24).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}:00`;

    // Standardized display label (e.g. "11:00 AM - 08:00 PM")
    const formattedStart = `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')} ${startPeriod}`;
    const formattedEnd = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')} ${endPeriod}`;
    const standardLabel = `${formattedStart} - ${formattedEnd}`;

    return {
      shiftType: 'SHIFT',
      shiftStartTime: startTime,
      shiftEndTime: endTime,
      shiftLabel: standardLabel,
      isValid: true,
      isOvernight,
      error: null
    };
  }

  /**
   * Convert 12-hour format to 24-hour integer
   */
  to24Hour(hour, period) {
    if (period === 'AM') {
      return hour === 12 ? 0 : hour;
    } else {
      return hour === 12 ? 12 : hour + 12;
    }
  }

  /**
   * Get weekday short name (Sun, Mon, Tue, etc.)
   */
  getWeekdayName(dayIndex) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[dayIndex];
  }

  /**
   * Get full month name
   */
  getMonthName(monthNum) {
    return this.MONTH_NAMES[monthNum - 1]
      ? this.MONTH_NAMES[monthNum - 1].charAt(0).toUpperCase() + this.MONTH_NAMES[monthNum - 1].slice(1)
      : `Month ${monthNum}`;
  }

  /**
   * Clean string helper
   */
  cleanString(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  /**
   * Validate parsed roster data
   */
  validateRoster(parsedData) {
    const errors = [];
    const warnings = [...(parsedData.warnings || [])];

    if (!parsedData.employees || parsedData.employees.length === 0) {
      errors.push('No employee rows found in the roster spreadsheet.');
    }

    if (parsedData.daysInMonth < 28 || parsedData.daysInMonth > 31) {
      warnings.push(`Days parsed (${parsedData.daysInMonth}) is unusual. Please verify the month and year.`);
    }

    parsedData.employees.forEach((emp) => {
      emp.dailyAssignments.forEach((day) => {
        if (!day.isValid && day.shiftType === 'INVALID') {
          errors.push(`Row ${emp.rowIndex} (${emp.rosterEmployeeName}) Day ${day.dayOfMonth}: ${day.error}`);
        }
      });

      if (emp.hasWorkingDaysDiscrepancy) {
        warnings.push(
          `Row ${emp.rowIndex} (${emp.rosterEmployeeName}): Working days mismatch — Calculated: ${emp.calculatedWorkingDays}, Declared: ${emp.declaredWorkingDays}`
        );
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

export default new RosterParserService();
