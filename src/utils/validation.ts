import { AppError } from "../middlewares/app-error.js";

// Deliberately simple: shape check only, real verification needs email.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MAX_EMAIL_LENGTH = 254;
export const MAX_NAME_LENGTH = 100;
// bcrypt ignores input beyond 72 bytes, so longer passwords are misleading.
export const MAX_PASSWORD_LENGTH = 72;

export const isEmail = (value: string): boolean =>
  value.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(value);

// Strict positive integer from a query string ("1.5", "1e3", "-1" rejected).
export const parsePositiveInt = (
  value: unknown,
  defaultValue: number,
  field: string
): number => {
  if (value === undefined) return defaultValue;

  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new AppError(`${field} must be a positive integer`, 400);
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new AppError(`${field} must be a positive integer`, 400);
  }

  return parsed;
};
