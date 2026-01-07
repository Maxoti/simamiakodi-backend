// helpers.js

/**
 * Format number as Kenyan currency
 * e.g., 1000 -> KSh 1,000.00
 */
const formatCurrency = (amount) => {
  return 'KSh ' + Number(amount).toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

/**
 * Format date in a readable Kenyan format
 * e.g., 2025-12-28 -> 28 December 2025
 */
const formatDate = (date) => {
  if (!date) return null;
  return new Date(date).toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Validate phone numbers
 * Supports:
 * - Local: 07XXXXXXXX or 01XXXXXXXX
 * - International: +2547XXXXXXXX or +2541XXXXXXXX
 * - Without +: 2547XXXXXXXX or 2541XXXXXXXX
 */
const validatePhone = (phone) => {
  if (!phone) return false;
  const str = phone.toString().trim();
  const localFormat = /^(07|01)\d{8}$/;
  const intlPlusFormat = /^\+254[17]\d{8}$/;
  const intlFormat = /^254[17]\d{8}$/;
  return localFormat.test(str) || intlPlusFormat.test(str) || intlFormat.test(str);
};

/**
 * Normalize phone number to +254XXXXXXXX format
 * e.g., 0712345678 -> +254712345678
 */
const normalizePhone = (phone) => {
  if (!phone) return null;
  let str = phone.toString().trim();
  if (str.startsWith('07')) return '+254' + str.slice(1);
  if (str.startsWith('01')) return '+254' + str.slice(1);
  if (str.startsWith('254')) return '+' + str;
  return str; // assume already normalized
};

/**
 * Validate ID number (minimum 8 digits)
 */
const validateIdNumber = (idNumber) => {
  if (!idNumber) return false;
  const str = idNumber.toString().trim();
  return /^[0-9]{8,}$/.test(str);
};

/**
 * Calculate months between two dates
 */
const monthsBetween = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
};

module.exports = {
  formatCurrency,
  formatDate,
  validatePhone,
  normalizePhone,
  validateIdNumber,
  monthsBetween
};
