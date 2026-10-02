/**
 * Special and Restricted Leave Type Utility Functions
 *
 * The six special leave categories (0 balance, Admin/HR/Reporting Manager assignment only):
 * 1. Holiday (HL)
 * 2. Absent Without Leave (AWOL)
 * 3. Leave Without Pay (LWP / LOP)
 * 4. Maternity Leave (ML)
 * 5. Sabbatical Leave (SBL)
 * 6. Paternity Leave (PTL / PATL)
 *
 * Normal balance-based categories:
 * - Planned Leave (PL)
 * - Casual Leave (CL)
 * - Sick Leave (SL)
 * - Half Day (HDL)
 * - Emergency (EL)
 */

export const SPECIAL_LEAVE_CODES = ['HL', 'AWOL', 'LOP', 'LWP', 'ML', 'PTL', 'PATL', 'SBL'];

export const SPECIAL_LEAVE_NAMES = [
  'holiday',
  'absent without leave',
  'awol',
  'leave without pay',
  'loss of pay',
  'lop',
  'lwp',
  'maternity leave',
  'maternity',
  'sabbatical leave',
  'sabbatical',
  'paternity leave',
  'paternity',
];

/**
 * Checks whether a given leave type object (or balance row) is one of the 6 special leave categories
 * Special leaves:
 * - Have a default balance of 0 days
 * - Can only be applied by Admin, HR, or the employee's Reporting Manager (within reporting scope)
 * - Employees CANNOT self-apply for them
 * - Are NEVER deducted from normal leave balances
 * - Are NEVER deducted from the special leave bucket (bucket stays at 0 days)
 * - Must never produce a negative balance
 */
export const isSpecialLeaveType = (lt) => {
  if (!lt) return false;
  const code = String(lt.code || lt.leaveTypeCode || lt.lt_code || '').trim().toUpperCase();
  const name = String(lt.name || lt.leaveTypeName || lt.lt_name || '').trim().toLowerCase();

  if (SPECIAL_LEAVE_CODES.includes(code)) return true;
  if (SPECIAL_LEAVE_NAMES.some((sn) => name === sn || name.includes(sn))) return true;

  // Additional defensive substring checks
  return (
    name.includes('holiday') ||
    name.includes('absent without leave') ||
    name.includes('awol') ||
    name.includes('without pay') ||
    name.includes('loss of pay') ||
    name.includes('maternity') ||
    name.includes('sabbatical') ||
    name.includes('paternity')
  );
};

/**
 * Alias for isSpecialLeaveType for backwards compatibility
 */
export const isRestrictedLeaveType = isSpecialLeaveType;

/**
 * Check whether a leave type is unpaid
 */
export const isUnpaidLeave = (lt) => {
  if (!lt) return false;
  if (lt.isPaid === false || lt.is_paid === false) {
    const code = String(lt.code || lt.leaveTypeCode || lt.lt_code || '').trim().toUpperCase();
    if (code === 'AWOL') return false;
    return true;
  }
  const code = String(lt.code || lt.leaveTypeCode || lt.lt_code || '').trim().toUpperCase();
  const name = String(lt.name || lt.leaveTypeName || lt.lt_name || '').trim().toLowerCase();
  return (
    code === 'LOP' ||
    code === 'LWP' ||
    name.includes('without pay') ||
    name.includes('loss of pay') ||
    name.includes('unpaid')
  );
};
