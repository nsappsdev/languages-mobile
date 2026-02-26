import { validateEmail, validateName, validatePassword } from '@/src/features/auth/utils/validators';

describe('auth validators', () => {
  it('validates email format', () => {
    expect(validateEmail('')).toBe('Email is required.');
    expect(validateEmail('invalid-email')).toBe('Enter a valid email address.');
    expect(validateEmail('user@example.com')).toBeNull();
  });

  it('validates name length bounds', () => {
    expect(validateName('')).toBe('Name is required.');
    expect(validateName('A')).toBe('Name must be at least 2 characters.');
    expect(validateName('A'.repeat(81))).toBe('Name must be 80 characters or fewer.');
    expect(validateName('Valid Name')).toBeNull();
  });

  it('validates password requirements', () => {
    expect(validatePassword('')).toBe('Password is required.');
    expect(validatePassword('abc')).toBe('Password must be at least 6 characters.');
    expect(validatePassword('123456')).toBe('Password must include at least one letter.');
    expect(validatePassword('abcdef')).toBe('Password must include at least one number.');
    expect(validatePassword('abc123')).toBeNull();
  });
});
