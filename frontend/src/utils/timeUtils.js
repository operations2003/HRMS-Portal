/**
 * Time and Duration Utilities
 *
 * Converts decimal hours (e.g. 7.83 hrs) into human-readable clock formats (e.g. "7h 50m").
 * Normalizes between decimal time and standard clock (base 60) time.
 */

/**
 * Formats a decimal hour value (e.g., 7.83) into a proper clock duration (e.g., "7h 50m").
 *
 * Examples:
 *  - 7.83  => "7h 50m" (0.83 * 60 = 49.8 => 50 mins)
 *  - 7.63  => "7h 38m" (0.63 * 60 = 37.8 => 38 mins)
 *  - 0.00  => "0h 00m"
 *  - 8.5   => "8h 30m"
 *
 * @param {number|string|null|undefined} decimalHours - Hours in decimal (e.g. 7.83)
 * @param {Object} [options]
 * @param {boolean} [options.padZero=false] - Pad hours to 2 digits (e.g. "07h 50m")
 * @param {boolean} [options.showZeroAsDash=false] - Return "—" if 0
 * @returns {string} Formatted duration like "7h 50m"
 */
export const formatHoursToClock = (decimalHours, options = {}) => {
  if (decimalHours === undefined || decimalHours === null || decimalHours === '') {
    return options.showZeroAsDash ? '—' : '0h 00m';
  }

  const num = Number(decimalHours);
  if (isNaN(num)) {
    return options.showZeroAsDash ? '—' : '0h 00m';
  }

  if (Math.abs(num) < 0.001) {
    return options.showZeroAsDash ? '—' : '0h 00m';
  }

  const isNegative = num < 0;
  const absNum = Math.abs(num);
  const totalMinutes = Math.round(absNum * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const sign = isNegative ? '-' : '';
  const formattedHours = options.padZero ? String(hours).padStart(2, '0') : hours;
  const formattedMinutes = String(minutes).padStart(2, '0');

  return `${sign}${formattedHours}h ${formattedMinutes}m`;
};

/**
 * Formats overtime decimal hours into "+Xh Ym" or "—".
 *
 * @param {number|string|null|undefined} otHours
 * @returns {string} E.g. "+1h 30m" or "—"
 */
export const formatOvertimeDuration = (otHours) => {
  const num = Number(otHours);
  if (!num || isNaN(num) || num <= 0) return '—';
  return `+${formatHoursToClock(num)}`;
};

/**
 * Formats a timestamp into 12-hour clock format (e.g. "11:05 AM")
 * taking into account the specified timezone or user/system default.
 *
 * @param {string|Date|null|undefined} dateStr
 * @param {string} [timezone] - e.g. "Asia/Kolkata", "UTC"
 * @returns {string} E.g. "11:05 AM" or "—"
 */
export const formatTimeWithTimezone = (dateStr, timezone = null) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
    return d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: tz,
    });
  } catch {
    try {
      return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return '—';
    }
  }
};

/**
 * Calculates live break duration in seconds from the currentBreakStart timestamp.
 *
 * @param {string|Date|null|undefined} currentBreakStart
 * @returns {number} Elapsed seconds
 */
export const getLiveBreakSeconds = (currentBreakStart) => {
  if (!currentBreakStart) return 0;
  const startMs = new Date(currentBreakStart).getTime();
  if (isNaN(startMs)) return 0;
  return Math.max(0, Math.floor((Date.now() - startMs) / 1000));
};

/**
 * Calculates live break duration in minutes from the currentBreakStart timestamp.
 *
 * @param {string|Date|null|undefined} currentBreakStart
 * @returns {number} Elapsed minutes
 */
export const getLiveBreakMinutes = (currentBreakStart) => {
  return Math.floor(getLiveBreakSeconds(currentBreakStart) / 60);
};

/**
 * Formats live break duration into a friendly string (e.g. "12 mins", "45s", "1h 15m").
 *
 * @param {string|Date|null|undefined} currentBreakStart
 * @returns {string}
 */
export const formatLiveBreakDuration = (currentBreakStart) => {
  const seconds = getLiveBreakSeconds(currentBreakStart);
  if (seconds <= 0) return '0 mins';
  const totalMinutes = Math.floor(seconds / 60);
  if (totalMinutes < 1) {
    return `${seconds}s`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours} hr${hours > 1 ? 's' : ''}`;
  }
  return `${minutes} min${minutes > 1 ? 's' : ''}`;
};

