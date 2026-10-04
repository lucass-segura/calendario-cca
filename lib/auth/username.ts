// Supabase Auth requires an email, so every member gets a deterministic internal address
// derived from the username. These addresses never receive mail: signups are disabled and
// users are created by the admin script with the email already confirmed.
export const INTERNAL_EMAIL_DOMAIN = 'users.cca-sector7.app';

export const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value);
}

export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${INTERNAL_EMAIL_DOMAIN}`;
}
