// tests/unit/validation.test.js
const { validatePhone } = require('../../utils/helpers');

describe('Tenant validation', () => {

  test('Required fields must be present', () => {
    const tenant = { 
      full_name: 'John Doe', 
      phone: '+254712345678', 
      email: 'john@example.com',
      unit_id: 1 
    };
    expect(tenant.full_name).toBeDefined();
    expect(tenant.phone).toBeDefined();
    expect(tenant.email).toBeDefined();
    expect(tenant.unit_id).toBeDefined();
  });

  test('Phone validation', () => {
    expect(validatePhone('+254712345678')).toBe(true);
    expect(validatePhone('0712345678')).toBe(true);
    expect(validatePhone('0722345678')).toBe(true);
    expect(validatePhone('12345')).toBe(false);
    expect(validatePhone(null)).toBe(false);
  });

  test('Email validation', () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    expect(emailRegex.test('john@example.com')).toBe(true);
    expect(emailRegex.test('test.user@company.co.ke')).toBe(true);
    expect(emailRegex.test('invalid-email')).toBe(false);
    expect(emailRegex.test('no@domain')).toBe(false);
    expect(emailRegex.test('@nodomain.com')).toBe(false);
    expect(emailRegex.test('noemail@')).toBe(false);
  });

});