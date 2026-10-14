/**
 * Shared utility functions for shift parsing and slot timing evaluation.
 */

/**
 * Parse time string to hour (0-23) and minute (0-59).
 * Supports: "11:00 AM", "7:00 PM", "2:00 PM", "06:08 PM", "10:00 PM", "21:00", etc.
 */
export const parseTimeStr = (timeStr, defaultPeriod = null) => {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const trimmed = timeStr.trim();
  const match12 = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = match12[2] ? parseInt(match12[2], 10) : 0;
    const period = (match12[3] || defaultPeriod || '').toUpperCase();
    if (period === 'PM' && h < 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return { hour: h, minute: m };
  }
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})/);
  if (match24) {
    return { hour: parseInt(match24[1], 10), minute: parseInt(match24[2], 10) };
  }
  return null;
};

/**
 * Parse start hour and minute from shift timing string.
 * Supports: "03:00 PM - 08:00 PM", "1:00 AM - 7:00 PM", "11:00 AM to 07:00 PM", "2:00 PM - 08:00 PM", "12 - 8 PM", etc.
 */
/**
 * Parse start, end, overnight flag, and scheduled duration hours from shift timing string.
 */
export const parseShiftTiming = (shiftTiming) => {
  const defaultShift = {
    startHour: 11,
    startMinute: 0,
    endHour: 19,
    endMinute: 0,
    scheduledDurationHours: 8.0,
    isOvernight: false,
  };

  if (!shiftTiming || typeof shiftTiming !== 'string') {
    return defaultShift;
  }

  const parts = shiftTiming.split(/\s*[-–—+]|\s+to\s+/i).map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) {
    const parsed = parseTimeStr(parts[0] || shiftTiming);
    const startH = parsed ? parsed.hour : 11;
    const startM = parsed ? parsed.minute : 0;
    const endH = (startH + 8) % 24;
    return {
      startHour: startH,
      startMinute: startM,
      endHour: endH,
      endMinute: startM,
      scheduledDurationHours: 8.0,
      isOvernight: endH < startH,
    };
  }

  const endPeriodMatch = parts[1].match(/(AM|PM)/i);
  const endPeriod = endPeriodMatch ? endPeriodMatch[1].toUpperCase() : null;

  let start = parseTimeStr(parts[0]);
  let end = parseTimeStr(parts[1]);

  if (!start || !end) {
    return defaultShift;
  }

  // If start had no AM/PM and start hour <= 6 and end period is PM, start is PM (e.g. 2 - 10 PM, 2-10 PM)
  if (!parts[0].match(/(AM|PM)/i) && endPeriod === 'PM' && start.hour >= 1 && start.hour <= 6) {
    start.hour += 12;
  }
  // If start had no AM/PM and end period is AM and start hour >= 4, start is PM (e.g. 7 - 3 AM, 8 - 4 AM)
  if (!parts[0].match(/(AM|PM)/i) && endPeriod === 'AM' && start.hour >= 4 && start.hour <= 11) {
    start.hour += 12;
  }

  let startMinutes = start.hour * 60 + start.minute;
  let endMinutes = end.hour * 60 + end.minute;
  let isOvernight = false;

  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
    isOvernight = true;
  }

  const durationHours = parseFloat(((endMinutes - startMinutes) / 60).toFixed(2));

  return {
    startHour: start.hour,
    startMinute: start.minute,
    endHour: end.hour,
    endMinute: end.minute,
    scheduledDurationHours: durationHours > 0 ? durationHours : 8.0,
    isOvernight,
  };
};

/**
 * Parse start hour and minute from shift timing string.
 * Accurately delegates to parseShiftTiming so all shifts (e.g. "2-10 PM", "11:00 AM to 07:00 PM")
 * correctly identify their start hour in 24-hour time.
 */
export const parseShiftStartTime = (shiftTiming) => {
  const timing = parseShiftTiming(shiftTiming);
  return { hour: timing.startHour, minute: timing.startMinute };
};

/**
 * Determines whether an employee's slot/shift timing has started.
 * - If targetDate is a past date (< today in Asia/Kolkata): returns true (past shift has started & ended).
 * - If targetDate is a future date (> today in Asia/Kolkata): returns false (future shift hasn't started).
 * - If targetDate is today: compares current local time in Asia/Kolkata with shift start time.
 */
export const hasShiftStarted = (shiftTiming, targetDate = null, graceMinutes = 0) => {
  const nowKolkata = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const todayStr = [
    nowKolkata.getFullYear(),
    String(nowKolkata.getMonth() + 1).padStart(2, '0'),
    String(nowKolkata.getDate()).padStart(2, '0'),
  ].join('-');

  const dateToCheck = targetDate
    ? typeof targetDate === 'string'
      ? targetDate.split('T')[0]
      : targetDate
    : todayStr;

  if (dateToCheck < todayStr) return true; // Past date
  if (dateToCheck > todayStr) return false; // Future date

  // Today: check whether current time has reached shift start time
  const shift = parseShiftStartTime(shiftTiming);
  const currentMinutes = nowKolkata.getHours() * 60 + nowKolkata.getMinutes();
  const shiftStartMinutes = shift.hour * 60 + shift.minute + (graceMinutes || 0);

  return currentMinutes >= shiftStartMinutes;
};
