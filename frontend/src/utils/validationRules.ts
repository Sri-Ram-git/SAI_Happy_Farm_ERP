/**
 * SAI Happy Farms ERP — Enterprise Form Validation & Constraint Engine
 * 
 * Centralized, field-specific validation rules, keystroke handlers, and
 * real-time feedback helpers across Admin and Supervisor modules.
 */

// ── Validation Result Types ───────────────────────────────────────
export interface ValidationResult {
  valid: boolean;
  error?: string;
  value?: any;
}

// ── Text & Name Validators ────────────────────────────────────────

/**
 * Validates human user full name.
 * Length: 1-100 characters.
 * Allowed: letters (multilingual Unicode), numbers, spaces, dots, commas, hyphens, apostrophes, ampersands, parentheses.
 */
export function validateName(val: string, fieldName = 'Full Name'): ValidationResult {
  const trimmed = val.trim();
  if (!trimmed) {
    return { valid: false, error: `${fieldName} is required.` };
  }
  if (trimmed.length > 100) {
    return { valid: false, error: `${fieldName} must be 100 characters or fewer.` };
  }
  // Allow Unicode letters, numbers, spaces, and standard name punctuation
  const namePattern = /^[\p{L}0-9\s.,'&\-()]+$/u;
  if (!namePattern.test(trimmed)) {
    return { valid: false, error: `${fieldName} contains invalid characters.` };
  }
  return { valid: true };
}

/**
 * Validates Farm Name.
 * Length: 1-100 characters.
 */
export function validateFarmName(val: string): ValidationResult {
  const trimmed = val.trim();
  if (!trimmed) {
    return { valid: false, error: 'Farm name is required.' };
  }
  if (trimmed.length > 100) {
    return { valid: false, error: 'Farm name must be 100 characters or fewer.' };
  }
  const farmPattern = /^[\p{L}0-9\s.,'&\-()/#]+$/u;
  if (!farmPattern.test(trimmed)) {
    return { valid: false, error: 'Farm name contains invalid characters.' };
  }
  return { valid: true };
}

/**
 * Validates Farm ID (e.g. "AP15", "FARM_01").
 * Length: 1-50 characters.
 * Characters: alphanumeric, underscores, hyphens.
 */
export function validateFarmId(val: string): ValidationResult {
  const trimmed = val.trim();
  if (!trimmed) {
    return { valid: false, error: 'Farm ID is required.' };
  }
  if (trimmed.length > 50) {
    return { valid: false, error: 'Farm ID must be 50 characters or fewer.' };
  }
  const idPattern = /^[a-zA-Z0-9_\-]+$/;
  if (!idPattern.test(trimmed)) {
    return { valid: false, error: 'Farm ID must contain only letters, numbers, hyphens, and underscores.' };
  }
  return { valid: true };
}

/**
 * Validates Flock Name / Identifier.
 * Length: Optional, max 100 characters.
 */
export function validateFlockName(val: string): ValidationResult {
  const trimmed = val.trim();
  if (!trimmed) {
    return { valid: true }; // Optional
  }
  if (trimmed.length > 100) {
    return { valid: false, error: 'Flock identifier must be 100 characters or fewer.' };
  }
  return { valid: true };
}

/**
 * Validates Breed / Type.
 * Length: Optional, max 50 characters.
 */
export function validateBreedType(val: string): ValidationResult {
  const trimmed = val.trim();
  if (!trimmed) {
    return { valid: true }; // Optional
  }
  if (trimmed.length > 50) {
    return { valid: false, error: 'Breed type must be 50 characters or fewer.' };
  }
  return { valid: true };
}

/**
 * Validates general remarks or notes textarea.
 * Length: Optional, max characters (default 1000).
 */
export function validateNotes(val: string, maxLen = 1000, fieldName = 'Notes'): ValidationResult {
  if (val && val.length > maxLen) {
    return { valid: false, error: `${fieldName} cannot exceed ${maxLen} characters.` };
  }
  return { valid: true };
}

// ── Email & Phone Validators ──────────────────────────────────────

/**
 * Validates Email address according to RFC 5321 (max 254 chars).
 */
export function validateEmail(val: string): ValidationResult {
  const trimmed = val.trim();
  if (!trimmed) {
    return { valid: false, error: 'Email address is required.' };
  }
  if (trimmed.length > 254) {
    return { valid: false, error: 'Email address must be 254 characters or fewer.' };
  }
  if (trimmed.includes('..') || trimmed.startsWith('.') || trimmed.endsWith('.')) {
    return { valid: false, error: 'Enter a valid email address.' };
  }
  const emailPattern = /^[a-zA-Z0-9_%+-]+(?:\.[a-zA-Z0-9_%+-]+)*@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
  if (!emailPattern.test(trimmed)) {
    return { valid: false, error: 'Enter a valid email address.' };
  }
  return { valid: true };
}

/**
 * Validates Phone number.
 * Allows digits, optional leading +, spaces, hyphens, and parentheses.
 * Ensures 7 to 15 digits (ITU E.164 standard), total length <= 20.
 */
export function validatePhone(val: string): ValidationResult {
  const trimmed = val.trim();
  if (!trimmed) {
    return { valid: false, error: 'Phone number is required.' };
  }
  if (trimmed.length > 20) {
    return { valid: false, error: 'Phone number must be 20 characters or fewer.' };
  }
  const phonePattern = /^\+?[0-9\s\-()]{7,20}$/;
  if (!phonePattern.test(trimmed)) {
    return { valid: false, error: 'Enter a valid phone number (digits and optional +, -, ()).' };
  }
  const digits = (trimmed.match(/\d/g) || []).length;
  if (digits < 7 || digits > 15) {
    return { valid: false, error: 'Phone number must contain between 7 and 15 digits.' };
  }
  return { valid: true };
}

// ── Password Validators ───────────────────────────────────────────

/**
 * Validates Password.
 * Length: 8-128 characters.
 */
export function validatePassword(val: string): ValidationResult {
  if (!val) {
    return { valid: false, error: 'Password is required.' };
  }
  if (val.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters.' };
  }
  if (val.length > 128) {
    return { valid: false, error: 'Password must be 128 characters or fewer.' };
  }
  return { valid: true };
}

/**
 * Validates Confirm Password matches original Password.
 */
export function validateConfirmPassword(password: string, confirmPassword: string): ValidationResult {
  if (!confirmPassword) {
    return { valid: false, error: 'Please confirm your password.' };
  }
  if (password !== confirmPassword) {
    return { valid: false, error: 'Passwords do not match.' };
  }
  return { valid: true };
}

// ── Numeric & Biological Operational Validators ───────────────────

export const MAX_BIRD_COUNT = 10_000_000;
export const MAX_FEED_QUANTITY_KG = 9_999_999.99;
export const MAX_FEED_STOCK_KG = 9_999_999.99;

/**
 * Validates Bird Population count.
 * Non-negative whole integer (0 to 10,000,000).
 */
export function validateBirdCount(
  val: string | number,
  isRequired = false,
  minVal = 0,
  maxVal = MAX_BIRD_COUNT
): ValidationResult {
  const str = String(val ?? '').trim();
  if (str === '') {
    if (isRequired) {
      return { valid: false, error: 'Bird count is required.' };
    }
    return { valid: true, value: 0 };
  }
  if (!/^\d+$/.test(str)) {
    return { valid: false, error: 'Bird count must be a non-negative whole number.' };
  }
  const num = Number(str);
  if (!Number.isSafeInteger(num) || num < minVal) {
    return { valid: false, error: `Bird count must be at least ${minVal}.` };
  }
  if (num > maxVal) {
    return { valid: false, error: `Bird count cannot exceed ${maxVal.toLocaleString()}.` };
  }
  return { valid: true, value: num };
}

/**
 * Validates Feed Stock or Quantity in Kilograms.
 * Non-negative number with at most 2 decimal places and 7 integer digits (0 to 9,999,999.99 Kg).
 */
export function validateFeedKg(
  val: string | number,
  isRequired = false,
  minVal = 0,
  maxVal = MAX_FEED_QUANTITY_KG
): ValidationResult {
  const str = String(val ?? '').trim();
  if (str === '') {
    if (isRequired) {
      return { valid: false, error: 'Feed quantity is required.' };
    }
    return { valid: true, value: 0 };
  }
  const pattern = /^(?:\d{1,7}(?:\.\d{1,2})?|\.\d{1,2})$/;
  if (!pattern.test(str)) {
    return {
      valid: false,
      error: 'Feed quantity must have at most 7 digits and 2 decimal places (max 9,999,999.99 Kg).',
    };
  }
  const num = Number(str);
  if (!Number.isFinite(num) || isNaN(num) || num < minVal) {
    return { valid: false, error: 'Feed quantity cannot be negative.' };
  }
  if (num > maxVal) {
    return { valid: false, error: `Feed quantity cannot exceed ${maxVal.toLocaleString()} Kg.` };
  }
  return { valid: true, value: Number(num.toFixed(2)) };
}

// ── Date & Date Range Validators ──────────────────────────────────

/**
 * Validates a single calendar date in YYYY-MM-DD format.
 * Checks realistic year bounds (2000 to 2100) and actual days in month.
 */
export function validateDate(val: string, fieldName = 'Date'): ValidationResult {
  const trimmed = val.trim();
  if (!trimmed) {
    return { valid: false, error: `${fieldName} is required.` };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { valid: false, error: `${fieldName} must be in YYYY-MM-DD format.` };
  }
  const [yStr, mStr, dStr] = trimmed.split('-');
  const y = parseInt(yStr!, 10);
  const m = parseInt(mStr!, 10);
  const d = parseInt(dStr!, 10);

  if (m < 1 || m > 12 || d < 1 || d > 31) {
    return { valid: false, error: `Enter a valid calendar date for ${fieldName}.` };
  }

  // Verify leap year and month day boundaries
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  if (dateObj.getUTCFullYear() !== y || dateObj.getUTCMonth() !== m - 1 || dateObj.getUTCDate() !== d) {
    return { valid: false, error: `Enter a valid calendar date for ${fieldName}.` };
  }

  if (y < 2000 || y > 2100) {
    return { valid: false, error: `${fieldName} year must be between 2000 and 2100.` };
  }

  return { valid: true };
}

/**
 * Validates Start Date and End Date range.
 * Ensures both dates are valid and start <= end.
 */
export function validateDateRange(start: string, end: string): ValidationResult {
  const startVal = validateDate(start, 'Start date');
  if (!startVal.valid) return startVal;
  const endVal = validateDate(end, 'End date');
  if (!endVal.valid) return endVal;
  if (start > end) {
    return { valid: false, error: 'End date must be on or after the start date.' };
  }
  return { valid: true };
}

// ── Real-Time Input Restrictors & Keystroke Handlers ──────────────

/**
 * Restricts keydown events on integer inputs (blocks e, E, +, -, .).
 */
export function handleIntegerKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
  if (['e', 'E', '+', '-', '.'].includes(e.key)) {
    e.preventDefault();
  }
}

/**
 * Restricts keydown events on decimal inputs (blocks e, E, +, -).
 */
export function handleDecimalKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
  if (['e', 'E', '+', '-'].includes(e.key)) {
    e.preventDefault();
  }
}

/**
 * Tests whether prospective string is valid for a live integer input.
 */
export function isValidIntegerInput(val: string, max?: number): boolean {
  if (val === '') return true;
  if (!/^\d+$/.test(val)) return false;
  if (max !== undefined && Number(val) > max) return false;
  return true;
}

/**
 * Tests whether prospective string is valid for a live decimal input.
 * Allows intermediate states such as "" or "1." or ".5" for smooth user typing.
 */
export function isValidDecimalInput(
  val: string,
  maxDigitsBeforeDecimal = 7,
  maxDecimals = 2,
  max?: number
): boolean {
  if (val === '') return true;
  const regex = new RegExp(
    `^(?:\\d{1,${maxDigitsBeforeDecimal}}(?:\\.\\d{0,${maxDecimals}})?|\\.\\d{0,${maxDecimals}})$`
  );
  if (!regex.test(val)) return false;
  if (max !== undefined && val !== '.' && Number(val) > max) return false;
  return true;
}

/**
 * Tests whether prospective string is valid for a live phone input.
 */
export function isValidPhoneInput(val: string): boolean {
  if (val === '') return true;
  if (val.length > 20) return false;
  return /^[+]?[0-9\s\-()]*$/.test(val);
}

/**
 * Tests whether prospective string is valid for a live Farm ID input.
 */
export function isValidFarmIdInput(val: string): boolean {
  if (val === '') return true;
  if (val.length > 50) return false;
  return /^[a-zA-Z0-9_\-]*$/.test(val);
}
