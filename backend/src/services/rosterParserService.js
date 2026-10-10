import XLSX from 'xlsx';
import { nanoid } from 'nanoid';

/**
 * Roster Parser Service
 * Parses Excel/CSV roster files with format:
 * - Column A: Employee Name
 * - Column B: Designation
 * - Columns C onward: Day numbers (1-31)
 * - Final column: Working Days
 */
class RosterParserService {
  /**
   * Parse Excel or CSV file buffer
   * @param {Buffer} fileBuffer - File buffer
   * @param {String} filename - Original filename
   * @param {Number} selectedMonth - Month (1-12)
   * @param {Number} selectedYear - Year (e.g., 2024)
   * @returns {Object} Parsed roster data
   */
  parseRosterFile(fileBuffer, filename, selectedMonth, selectedYear) {
    try {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: false, cellText: true });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to 2D array with raw values
      const data = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1,
        raw: false,
        defval: '',
        blankrows: false
      });

      if (!data || data.length < 3) {
        throw new Error('Invalid roster file: Insufficient rows. Expected at least header + weekday + data rows.');
      }

      return this.parseRosterData(data, selectedMonth, selectedYear, filename);
    } catch (err) {
      throw new Error(`Failed to parse roster file: ${err.message}`);
    }
  }

  /**
   * Parse 2D array roster data
   */
  parseRosterData(data, selectedMonth, selectedYear, filename) {
    // Find header row (contains day numbers 1, 2, 3, etc.)
    let headerRowIndex = -1;
    let weekdayRowIndex = -1;

    for (let i = 0; i < Math.min(5, data.length); i++) {
      const row = data[i];
      if (!row || row.length < 5) continue;

      // Check if this row contains day numbers starting from column C (index 2)
      const hasSequentialDays = this.isHeaderRow(row);
      if (hasSequentialDays) {
        headerRowIndex = i;
        // Weekday row is typically the next row
        if (i + 1 < data.length) {
          weekdayRowIndex = i + 1;
        }
        break;
      }
    }

    if (headerRowIndex === -1) {
      throw new Error('Could not find header row with day numbers (1, 2, 3, ...). Please verify roster format.');
    }

    const headerRow = data[headerRowIndex];
    const weekdayRow = weekdayRowIndex >= 0 ? data[weekdayRowIndex] : null;

    // Parse day columns (starting from column C, index 2)
    const dayColumns = this.parseDayColumns(headerRow, selectedMonth, selectedYear);

    if (dayColumns.length === 0) {
      throw new Error('No valid day columns found in roster header.');
    }

    // Find working days column (last column with "Working Days" or similar)
    const workingDaysColIndex = this.findWorkingDaysColumn(headerRow);

    // Parse employee rows (start after weekday row or header+1)
    const dataStartRow = weekdayRowIndex >= 0 ? weekdayRowIndex + 1 : headerRowIndex + 1;
    const employees = [];
    const unmatchedNames = [];
    const errors = [];

    for (let i = dataStartRow; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 3) continue;

      const employeeName = this.cleanString(row[0]);
      const designation = this.cleanString(row[1]);

      if (!employeeName || employeeName.length < 2) continue; // Skip empty rows

      const dailyAssignments = [];
      let workingDaysCount = 0;

      // Parse each day column
      for (const dayCol of dayColumns) {
        const cellValue = this.cleanString(row[dayCol.columnIndex]);
        const parsed = this.parseShiftCell(cellValue, dayCol.date, employeeName);

        dailyAssignments.push({
          date: dayCol.date,
          dayOfMonth: dayCol.dayNumber,
          weekday: dayCol.weekday,
          originalValue: cellValue,
          ...parsed
        });

        // Count working days (not WO, HD, CL, NA, or blank)
        if (parsed.shiftType === 'SHIFT' && parsed.isValid) {
          workingDaysCount++;
        }
      }

      // Get declared working days from last column
      const declaredWorkingDays = workingDaysColIndex >= 0 
        ? parseInt(this.cleanString(row[workingDaysColIndex])) || 0 
        : 0;

      const hasWorkingDaysDiscrepancy = declaredWorkingDays > 0 && workingDaysCount !== declaredWorkingDays;

      employees.push({
        id: nanoid(),
        rosterEmployeeName: employeeName,
        designation,
        dailyAssignments,
        calculatedWorkingDays: workingDaysCount,
        declaredWorkingDays,
        hasWorkingDaysDiscrepancy,
        rowIndex: i + 1 // Excel row number (1-indexed)
      });
    }

    return {
      filename,
      selectedMonth,
      selectedYear,
      daysInMonth: dayColumns.length,
      headerRowIndex: headerRowIndex + 1,
      weekdayRowIndex: weekdayRowIndex >= 0 ? weekdayRowIndex + 1 : null,
      totalEmployees: employees.length,
      employees,
      dayColumns,
      errors: errors.length > 0 ? errors : null,
      parsedAt: new Date().toISOString()
    };
  }

  /**
   * Check if a row is the header row with day numbers
   */
  isHeaderRow(row) {
    if (!row || row.length < 5) return false;

    // Check columns C onwards (index 2+) for sequential day numbers
    let consecutiveDays = 0;
    for (let i = 2; i < Math.min(row.length, 10); i++) {
      const val = this.cleanString(row[i]);
      const num = parseInt(val);
      if (num >= 1 && num <= 31 && val === num.toString()) {
        consecutiveDays++;
        if (consecutiveDays >= 3) return true; // Found at least 3 consecutive days
      } else {
        consecutiveDays = 0;
      }
    }
    return false;
  }

  /**
   * Parse day columns from header row
   */
  parseDayColumns(headerRow, month, year) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const dayColumns = [];

    for (let i = 2; i < headerRow.length; i++) {
      const cellValue = this.cleanString(headerRow[i]);
      const dayNum = parseInt(cellValue);

      if (dayNum >= 1 && dayNum <= 31 && cellValue === dayNum.toString()) {
        // Validate day exists in selected month
        if (dayNum <= daysInMonth) {
          const date = new Date(year, month - 1, dayNum);
          const weekday = this.getWeekdayName(date.getDay());

          dayColumns.push({
            columnIndex: i,
            dayNumber: dayNum,
            date: date.toISOString().split('T')[0], // YYYY-MM-DD
            weekday
          });
        }
      } else if (dayColumns.length > 0) {
        // Stop when we hit non-day columns after finding day columns
        break;
      }
    }

    return dayColumns;
  }

  /**
   * Find "Working Days" column index
   */
  findWorkingDaysColumn(headerRow) {
    for (let i = headerRow.length - 1; i >= 0; i--) {
      const val = this.cleanString(headerRow[i]).toLowerCase();
      if (val.includes('working') && val.includes('day')) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Parse individual shift cell value
   * Supports: "11 - 8 PM", "2-8PM", "WO", "CL", "HD", "NA", blank
   */
  parseShiftCell(cellValue, date, employeeName) {
    const cleaned = cellValue.toUpperCase().trim();

    // Handle blank cells
    if (!cleaned || cleaned.length === 0) {
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

    // Handle roster codes: WO, CL, HD, NA
    const rosterCodes = ['WO', 'CL', 'HD', 'NA'];
    if (rosterCodes.includes(cleaned)) {
      return {
        shiftType: cleaned,
        shiftStartTime: null,
        shiftEndTime: null,
        shiftLabel: cellValue,
        isValid: true,
        isOvernight: false,
        error: null
      };
    }

    // Parse shift times (e.g., "11 - 8 PM", "2-8PM", "1 - 7 PM")
    return this.parseShiftTime(cellValue, date, employeeName);
  }

  /**
   * Parse shift time patterns
   * Important: "11 - 8 PM" means 11:00 AM to 8:00 PM (not 11 PM)
   */
  parseShiftTime(value, date, employeeName) {
    const cleaned = value.trim();
    
    // Pattern: "11 - 8 PM", "2-8PM", "1 - 7 PM", "11-5PM"
    const pattern = /^(\d{1,2})\s*-\s*(\d{1,2})\s*(AM|PM)?$/i;
    const match = cleaned.match(pattern);

    if (!match) {
      return {
        shiftType: 'INVALID',
        shiftStartTime: null,
        shiftEndTime: null,
        shiftLabel: value,
        isValid: false,
        isOvernight: false,
        error: `Invalid shift format: "${value}". Expected format like "11 - 8 PM"`
      };
    }

    let startHour = parseInt(match[1]);
    let endHour = parseInt(match[2]);
    const period = match[3] ? match[3].toUpperCase() : null;

    if (startHour < 1 || startHour > 12 || endHour < 1 || endHour > 12) {
      return {
        shiftType: 'INVALID',
        shiftStartTime: null,
        shiftEndTime: null,
        shiftLabel: value,
        isValid: false,
        isOvernight: false,
        error: `Invalid hours in shift: "${value}". Hours must be 1-12.`
      };
    }

    // Determine AM/PM for each time
    // Rule: If only end time has AM/PM, assume start is AM and end follows the period
    // Example: "11 - 8 PM" = 11 AM to 8 PM
    // Example: "11 - 8 AM" = 11 PM (previous day) to 8 AM (overnight)
    // Example: "2 - 8 PM" = 2 PM to 8 PM
    
    let startPeriod, endPeriod;
    let isOvernight = false;

    if (period) {
      endPeriod = period;
      
      // If end is PM and start < end, start is AM (common day shift)
      // If end is PM and start >= end, start is PM (evening shift)
      // If end is AM, it's likely overnight shift, start is PM previous day
      if (period === 'PM') {
        if (startHour < endHour) {
          startPeriod = 'AM'; // 11 - 8 PM => 11 AM to 8 PM
        } else {
          startPeriod = 'PM'; // 8 - 5 PM => 8 PM to 5 PM (next day, but treat as same day for short shifts)
          if (startHour > endHour) {
            // Actually overnight: 11 PM to 5 AM next day? Uncommon for "11-5PM" format
            // For now, treat same period: 2 PM - 8 PM, 11 AM - 8 PM
            startPeriod = startHour <= 11 ? 'AM' : 'PM';
          }
        }
      } else {
        // End is AM - likely overnight shift
        startPeriod = 'PM'; // Assume previous day PM
        isOvernight = true;
      }
    } else {
      // No AM/PM specified - make educated guess
      // If end > start, both same period (likely PM for work shifts)
      // Common: 9-5, 11-7 => assume PM or AM-PM
      if (startHour < endHour) {
        startPeriod = 'AM';
        endPeriod = 'PM';
      } else {
        // Overnight or invalid
        startPeriod = 'PM';
        endPeriod = 'AM';
        isOvernight = true;
      }
    }

    // Convert to 24-hour format
    const start24 = this.to24Hour(startHour, startPeriod);
    const end24 = this.to24Hour(endHour, endPeriod);

    // Create time strings HH:MM:SS
    const startTime = `${String(start24).padStart(2, '0')}:00:00`;
    const endTime = `${String(end24).padStart(2, '0')}:00:00`;

    // Check if overnight (end time in 24h is less than start, and not same day short shift)
    if (start24 > end24 && !isOvernight) {
      isOvernight = true;
    }

    return {
      shiftType: 'SHIFT',
      shiftStartTime: startTime,
      shiftEndTime: endTime,
      shiftLabel: value,
      isValid: true,
      isOvernight,
      error: null
    };
  }

  /**
   * Convert 12-hour time to 24-hour
   */
  to24Hour(hour, period) {
    if (period === 'AM') {
      return hour === 12 ? 0 : hour;
    } else {
      return hour === 12 ? 12 : hour + 12;
    }
  }

  /**
   * Get weekday name from day index (0=Sun, 6=Sat)
   */
  getWeekdayName(dayIndex) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[dayIndex];
  }

  /**
   * Clean and normalize string values
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
    const warnings = [];

    if (!parsedData.employees || parsedData.employees.length === 0) {
      errors.push('No employee data found in roster file.');
    }

    if (parsedData.daysInMonth < 28 || parsedData.daysInMonth > 31) {
      warnings.push(`Unusual number of days: ${parsedData.daysInMonth}. Verify month selection.`);
    }

    // Check for invalid shifts
    parsedData.employees.forEach(emp => {
      emp.dailyAssignments.forEach(day => {
        if (!day.isValid && day.shiftType !== 'BLANK') {
          errors.push(`${emp.rosterEmployeeName} - Day ${day.dayOfMonth}: ${day.error}`);
        }
      });

      if (emp.hasWorkingDaysDiscrepancy) {
        warnings.push(
          `${emp.rosterEmployeeName}: Working days mismatch - Calculated: ${emp.calculatedWorkingDays}, Declared: ${emp.declaredWorkingDays}`
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
