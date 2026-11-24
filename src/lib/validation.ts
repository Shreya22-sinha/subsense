/** Form validators. Each returns an error message, or null when valid. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateName(name: string): string | null {
  const len = name.trim().length;
  if (len < 2) return 'Name must be at least 2 characters.';
  if (len > 40) return 'Name must be 40 characters or fewer.';
  return null;
}

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Enter your email.';
  if (!EMAIL_RE.test(email.trim())) return 'Enter a valid email address.';
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Use at least 8 characters.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
    return 'Include at least one letter and one number.';
  return null;
}

export function validateConfirmPassword(password: string, confirm: string): string | null {
  if (!confirm) return 'Confirm your password.';
  if (password !== confirm) return "Passwords don't match.";
  return null;
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}
