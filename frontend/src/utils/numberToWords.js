/**
 * Indian Currency Number to Words Converter
 * Converts numeric amounts (e.g. 73000) into formal Indian currency words:
 * "Rupees Seventy Three Thousand Only"
 */

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];

const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
];

function convertBelowThousand(num) {
  let str = '';
  if (num >= 100) {
    str += ONES[Math.floor(num / 100)] + ' Hundred ';
    num %= 100;
  }
  if (num >= 20) {
    str += TENS[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + ONES[num % 10] : '');
  } else if (num > 0) {
    str += ONES[num];
  }
  return str.trim();
}

/**
 * Converts a positive number to Indian Currency words (Crores, Lakhs, Thousands, Hundreds)
 * @param {number|string} amount 
 * @param {string} currencyName e.g. 'Rupees'
 * @returns {string}
 */
export function numberToWordsIndian(amount, currencyName = 'Rupees') {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '—';
  }

  const numVal = Math.abs(Number(amount));
  if (numVal === 0) {
    return `${currencyName} Zero Only`;
  }

  const integerPart = Math.floor(numVal);
  const decimalPart = Math.round((numVal - integerPart) * 100);

  let remaining = integerPart;
  const parts = [];

  // Crores (>= 1,00,00,000)
  if (remaining >= 10000000) {
    const crore = Math.floor(remaining / 10000000);
    parts.push(convertBelowThousand(crore) + ' Crore');
    remaining %= 10000000;
  }

  // Lakhs (>= 1,00,000)
  if (remaining >= 100000) {
    const lakh = Math.floor(remaining / 100000);
    parts.push(convertBelowThousand(lakh) + ' Lakh');
    remaining %= 100000;
  }

  // Thousands (>= 1,000)
  if (remaining >= 1000) {
    const thousand = Math.floor(remaining / 1000);
    parts.push(convertBelowThousand(thousand) + ' Thousand');
    remaining %= 1000;
  }

  // Hundreds & below (< 1000)
  if (remaining > 0) {
    parts.push(convertBelowThousand(remaining));
  }

  const words = parts.filter(Boolean).join(' ');
  let result = `${currencyName} ${words}`;

  if (decimalPart > 0) {
    result += ` and ${convertBelowThousand(decimalPart)} Paise`;
  }

  return `${result} Only`;
}
