import { autoCheckoutStaleRecords } from './attendanceService.js';
import { logger } from '../utils/logger.js';

let cronTimer = null;

/**
 * Executes a single sweep to auto-checkout unclosed attendance records exceeding shift + 10 hours
 */
export const runAttendanceAutoLogoutSweep = async () => {
  try {
    const closedCount = await autoCheckoutStaleRecords(null);
    if (closedCount > 0) {
      logger.info('AttendanceCronService', `Auto-logout job finalized ${closedCount} stale attendance record(s) exceeding shift + 10h.`);
    }
  } catch (err) {
    logger.error('AttendanceCronService', `Error in auto-logout job sweep: ${err.message}`);
  }
};

/**
 * Starts recurring background timer for attendance auto-logout
 * Default interval: 10 minutes (600,000 ms)
 */
export const startAttendanceAutoLogoutJob = (intervalMs = 10 * 60 * 1000) => {
  if (cronTimer) {
    clearInterval(cronTimer);
  }

  // Run initial sweep shortly after startup (after 5 seconds)
  setTimeout(() => {
    runAttendanceAutoLogoutSweep();
  }, 5000);

  // Set recurring interval
  cronTimer = setInterval(() => {
    runAttendanceAutoLogoutSweep();
  }, intervalMs);

  logger.info('AttendanceCronService', `Attendance auto-logout background job started (interval: ${intervalMs / 60000} mins).`);
};

/**
 * Stops recurring background timer
 */
export const stopAttendanceAutoLogoutJob = () => {
  if (cronTimer) {
    clearInterval(cronTimer);
    cronTimer = null;
    logger.info('AttendanceCronService', 'Attendance auto-logout background job stopped.');
  }
};
