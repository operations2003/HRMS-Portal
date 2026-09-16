/**
 * Financial Calculation Utilities
 * 
 * Implements exact integer-cents fixed-point arithmetic to prevent
 * IEEE 754 floating-point inaccuracies in financial calculations.
 */

/**
 * Converts a numeric or string monetary value to integer cents (or paise).
 * Rounds half-up to the nearest integer cent.
 * @param {number|string} amount
 * @returns {number} Integer cents
 */
export const toCents = (amount) => {
  if (amount === null || amount === undefined || amount === '') return 0;
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/,/g, '').trim());
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
};

/**
 * Converts integer cents back to a standardized 2-decimal-place string.
 * @param {number} cents
 * @returns {string} e.g. "1500.00"
 */
export const fromCents = (cents) => {
  const c = parseInt(cents, 10) || 0;
  return (c / 100).toFixed(2);
};

/**
 * Adds two monetary values with fixed-point accuracy.
 * @param {number|string} a
 * @param {number|string} b
 * @returns {string} 2-decimal-place string
 */
export const addMoney = (a, b) => {
  const sum = toCents(a) + toCents(b);
  return fromCents(sum);
};

/**
 * Subtracts monetary value b from a with fixed-point accuracy.
 * @param {number|string} a
 * @param {number|string} b
 * @returns {string} 2-decimal-place string
 */
export const subtractMoney = (a, b) => {
  const diff = toCents(a) - toCents(b);
  return fromCents(diff);
};

/**
 * Sums an array of monetary values with fixed-point accuracy.
 * @param {Array<number|string>} amounts
 * @returns {string} 2-decimal-place string
 */
export const sumMoney = (amounts = []) => {
  if (!Array.isArray(amounts) || amounts.length === 0) return '0.00';
  const totalCents = amounts.reduce((acc, curr) => acc + toCents(curr), 0);
  return fromCents(totalCents);
};

/**
 * Validates that an amount is a valid non-negative financial value.
 * @param {any} amount
 * @returns {boolean}
 */
export const isValidMoney = (amount) => {
  if (amount === null || amount === undefined || amount === '') return false;
  const str = String(amount).replace(/,/g, '').trim();
  // Match standard non-negative currency: e.g. 100, 100.5, 100.50
  if (!/^\d+(\.\d{1,2})?$/.test(str)) return false;
  const num = parseFloat(str);
  return !isNaN(num) && num >= 0 && Number.isFinite(num);
};

/**
 * Formats a monetary value to a standard currency string.
 * @param {number|string} amount
 * @param {string} currency
 * @returns {string}
 */
export const formatMoney = (amount, currency = 'INR') => {
  const fixed = fromCents(toCents(amount));
  return `${currency} ${fixed}`;
};
