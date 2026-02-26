export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) {
    return 'Email is required.';
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(trimmed)) {
    return 'Enter a valid email address.';
  }

  return null;
}

export function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'Name is required.';
  }

  if (trimmed.length < 2) {
    return 'Name must be at least 2 characters.';
  }

  if (trimmed.length > 80) {
    return 'Name must be 80 characters or fewer.';
  }

  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) {
    return 'Password is required.';
  }

  if (password.length < 6) {
    return 'Password must be at least 6 characters.';
  }

  if (!/[A-Za-z]/.test(password)) {
    return 'Password must include at least one letter.';
  }

  if (!/[0-9]/.test(password)) {
    return 'Password must include at least one number.';
  }

  return null;
}
