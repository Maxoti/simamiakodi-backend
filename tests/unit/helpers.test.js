// tests/helper.test.js
const {
  formatCurrency,
  formatDate,
  validatePhone,
  normalizePhone,
  monthsBetween
} = require('../../utils/helpers');

describe('Helper functions', () => {

  test('formatCurrency formats numbers correctly', () => {
    expect(formatCurrency(1000)).toBe('KSh 1,000.00');
    expect(formatCurrency(1234567.89)).toBe('KSh 1,234,567.89');
  });

  test('formatDate formats date correctly', () => {
    expect(formatDate('2025-12-28')).toBe('28 December 2025');
    expect(formatDate(null)).toBeNull();
  });

  test('validatePhone returns true for valid formats', () => {
    const validPhones = [
      '0712345678',
      '0112345678',
      '+254712345678',
      '+254112345678',
      '254712345678',
      '254112345678'
    ];
    validPhones.forEach(phone => expect(validatePhone(phone)).toBe(true));
  });

  test('validatePhone returns false for invalid formats', () => {
    const invalidPhones = [
      '12345678',
      '07123',
      '+1234567890',
      '25491234567'
    ];
    invalidPhones.forEach(phone => expect(validatePhone(phone)).toBe(false));
  });

  test('normalizePhone converts numbers to +254XXXXXXXX format', () => {
    expect(normalizePhone('0712345678')).toBe('+254712345678');
    expect(normalizePhone('0112345678')).toBe('+254112345678');
    expect(normalizePhone('254712345678')).toBe('+254712345678');
    expect(normalizePhone('+254712345678')).toBe('+254712345678');
  });

 

  test('monthsBetween calculates correctly', () => {
    expect(monthsBetween('2025-01-01', '2025-12-01')).toBe(11);
    expect(monthsBetween('2025-01-01', '2026-01-01')).toBe(12);
  });

});
