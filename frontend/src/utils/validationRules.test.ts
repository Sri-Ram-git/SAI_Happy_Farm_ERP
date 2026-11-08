import { describe, it, expect } from 'vitest';
import {
  validateName,
  validateFarmName,
  validateFarmId,
  validateFlockName,
  validateBreedType,
  validateNotes,
  validateEmail,
  validatePhone,
  validatePassword,
  validateConfirmPassword,
  validateBirdCount,
  validateFeedKg,
  validateDate,
  validateDateRange,
  isValidIntegerInput,
  isValidDecimalInput,
  isValidPhoneInput,
  isValidFarmIdInput,
  MAX_BIRD_COUNT,
  MAX_FEED_QUANTITY_KG,
} from './validationRules';

describe('Global Input Constraints and Real-Time Form Validation Suite', () => {
  describe('1. Name and Farm Name Validation', () => {
    it('should accept valid human names', () => {
      expect(validateName('Sriram S').valid).toBe(true);
      expect(validateName('Dr. A. P. J. Abdul Kalam').valid).toBe(true);
      expect(validateName('Mary-Jane O\'Connor').valid).toBe(true);
      expect(validateName('Supervisor 1').valid).toBe(true);
    });

    it('should reject empty or whitespace-only names', () => {
      expect(validateName('').valid).toBe(false);
      expect(validateName('   ').valid).toBe(false);
      expect(validateName('').error).toContain('required');
    });

    it('should reject names exceeding 100 characters', () => {
      const longName = 'A'.repeat(101);
      const res = validateName(longName);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('100 characters or fewer');
    });

    it('should reject names containing invalid special characters or scripts', () => {
      expect(validateName('<script>alert(1)</script>').valid).toBe(false);
      expect(validateName('User@#$%').valid).toBe(false);
    });

    it('should accept valid farm names with legal punctuation', () => {
      expect(validateFarmName('Sri Ram Poultry Unit #1 (South)').valid).toBe(true);
      expect(validateFarmName('Green Acres & Sons / Layer Farm').valid).toBe(true);
    });

    it('should reject empty or excessive farm names', () => {
      expect(validateFarmName('').valid).toBe(false);
      expect(validateFarmName('A'.repeat(101)).valid).toBe(false);
    });
  });

  describe('2. Farm ID Validation', () => {
    it('should accept standard Farm IDs', () => {
      expect(validateFarmId('AP15').valid).toBe(true);
      expect(validateFarmId('FARM_01').valid).toBe(true);
      expect(validateFarmId('BL-102').valid).toBe(true);
    });

    it('should reject empty, spaced, or special-char Farm IDs', () => {
      expect(validateFarmId('').valid).toBe(false);
      expect(validateFarmId('AP 15').valid).toBe(false);
      expect(validateFarmId('AP@15').valid).toBe(false);
      expect(validateFarmId('AP15.').valid).toBe(false);
    });

    it('should reject Farm IDs longer than 50 characters', () => {
      expect(validateFarmId('A'.repeat(51)).valid).toBe(false);
    });

    it('should correctly test live Farm ID keystroke validity', () => {
      expect(isValidFarmIdInput('')).toBe(true);
      expect(isValidFarmIdInput('AP15')).toBe(true);
      expect(isValidFarmIdInput('AP 15')).toBe(false);
      expect(isValidFarmIdInput('AP$15')).toBe(false);
    });
  });

  describe('3. Email Validation', () => {
    it('should accept valid email addresses', () => {
      expect(validateEmail('admin@saihappyfarms.com').valid).toBe(true);
      expect(validateEmail('supervisor.user@domain.co.in').valid).toBe(true);
      expect(validateEmail('farmer+1@example.org').valid).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(validateEmail('').valid).toBe(false);
      expect(validateEmail('admin').valid).toBe(false);
      expect(validateEmail('admin@').valid).toBe(false);
      expect(validateEmail('admin@domain').valid).toBe(false);
      expect(validateEmail('admin@domain..com').valid).toBe(false);
      expect(validateEmail('admin @domain.com').valid).toBe(false);
    });

    it('should reject emails exceeding 254 characters', () => {
      const longEmail = 'a'.repeat(245) + '@domain.com';
      expect(validateEmail(longEmail).valid).toBe(false);
    });
  });

  describe('4. Phone Number Validation', () => {
    it('should accept standard domestic and international numbers', () => {
      expect(validatePhone('9876543210').valid).toBe(true);
      expect(validatePhone('+91 9876543210').valid).toBe(true);
      expect(validatePhone('+1 (555) 123-4567').valid).toBe(true);
      expect(validatePhone('040-23456789').valid).toBe(true);
    });

    it('should reject empty, too short, or too long numbers', () => {
      expect(validatePhone('').valid).toBe(false);
      expect(validatePhone('12345').valid).toBe(false); // only 5 digits
      expect(validatePhone('1234567890123456').valid).toBe(false); // 16 digits
    });

    it('should reject letters and illegal characters in phone numbers', () => {
      expect(validatePhone('98765abcde').valid).toBe(false);
      expect(validatePhone('+91-9876<script>').valid).toBe(false);
    });

    it('should validate live keystroke characters for phone input', () => {
      expect(isValidPhoneInput('')).toBe(true);
      expect(isValidPhoneInput('+91 987')).toBe(true);
      expect(isValidPhoneInput('987-654-(321)')).toBe(true);
      expect(isValidPhoneInput('987a')).toBe(false);
    });
  });

  describe('5. Password and Confirmation Validation', () => {
    it('should accept valid passwords >= 8 chars and <= 128 chars', () => {
      expect(validatePassword('HappyFarm2026!').valid).toBe(true);
      expect(validatePassword('12345678').valid).toBe(true);
    });

    it('should reject short or empty passwords', () => {
      expect(validatePassword('').valid).toBe(false);
      expect(validatePassword('short').valid).toBe(false);
      expect(validatePassword('short').error).toContain('at least 8 characters');
    });

    it('should reject passwords exceeding 128 characters', () => {
      expect(validatePassword('A'.repeat(129)).valid).toBe(false);
    });

    it('should validate password confirmation matches exactly', () => {
      expect(validateConfirmPassword('Secret123', 'Secret123').valid).toBe(true);
      expect(validateConfirmPassword('Secret123', 'Secret456').valid).toBe(false);
      expect(validateConfirmPassword('Secret123', '').valid).toBe(false);
    });
  });

  describe('6. Bird Population Validation', () => {
    it('should accept valid bird counts', () => {
      expect(validateBirdCount('0').valid).toBe(true);
      expect(validateBirdCount(0).valid).toBe(true);
      expect(validateBirdCount('1500').valid).toBe(true);
      expect(validateBirdCount('1000000').valid).toBe(true);
    });

    it('should handle optional empty input as 0', () => {
      const res = validateBirdCount('', false);
      expect(res.valid).toBe(true);
      expect(res.value).toBe(0);
    });

    it('should reject empty input when required', () => {
      expect(validateBirdCount('', true).valid).toBe(false);
    });

    it('should reject decimals, negatives, and non-numeric inputs', () => {
      expect(validateBirdCount('10.5').valid).toBe(false);
      expect(validateBirdCount('-5').valid).toBe(false);
      expect(validateBirdCount('1000e2').valid).toBe(false);
      expect(validateBirdCount('birds').valid).toBe(false);
    });

    it('should reject bird counts exceeding maximum limit', () => {
      expect(validateBirdCount(MAX_BIRD_COUNT + 1).valid).toBe(false);
      expect(validateBirdCount('10000001').valid).toBe(false);
    });

    it('should validate live integer typing input', () => {
      expect(isValidIntegerInput('')).toBe(true);
      expect(isValidIntegerInput('1250')).toBe(true);
      expect(isValidIntegerInput('12.5')).toBe(false);
      expect(isValidIntegerInput('-10')).toBe(false);
      expect(isValidIntegerInput('500', 300)).toBe(false);
    });
  });

  describe('7. Feed Quantity and Stock Validation', () => {
    it('should accept valid feed quantities with up to 2 decimal places', () => {
      expect(validateFeedKg('0').valid).toBe(true);
      expect(validateFeedKg('500').valid).toBe(true);
      expect(validateFeedKg('1250.5').valid).toBe(true);
      expect(validateFeedKg('9999999.99').valid).toBe(true);
    });

    it('should reject negative numbers, excessive decimals, and excessive digits', () => {
      expect(validateFeedKg('-50').valid).toBe(false);
      expect(validateFeedKg('500.123').valid).toBe(false); // 3 decimals
      expect(validateFeedKg('10000000').valid).toBe(false); // 8 digits
      expect(validateFeedKg(MAX_FEED_QUANTITY_KG + 1).valid).toBe(false);
    });

    it('should validate live decimal typing input without breaking intermediate states', () => {
      expect(isValidDecimalInput('')).toBe(true);
      expect(isValidDecimalInput('.')).toBe(true);
      expect(isValidDecimalInput('1.')).toBe(true);
      expect(isValidDecimalInput('1.5')).toBe(true);
      expect(isValidDecimalInput('1.55')).toBe(true);
      expect(isValidDecimalInput('1.555')).toBe(false); // > 2 decimals
      expect(isValidDecimalInput('12345678')).toBe(false); // > 7 integer digits
    });
  });

  describe('8. Date and Date Range Validation', () => {
    it('should accept valid calendar dates', () => {
      expect(validateDate('2026-10-01').valid).toBe(true);
      expect(validateDate('2024-02-29').valid).toBe(true); // Leap year 2024
    });

    it('should reject impossible calendar dates', () => {
      expect(validateDate('2026-02-29').valid).toBe(false); // 2026 is not a leap year
      expect(validateDate('2026-04-31').valid).toBe(false); // April has 30 days
      expect(validateDate('2026-13-01').valid).toBe(false); // Month 13
      expect(validateDate('2026-00-10').valid).toBe(false); // Month 0
      expect(validateDate('1999-12-31').valid).toBe(false); // Year < 2000
    });

    it('should validate date range relationships', () => {
      expect(validateDateRange('2026-09-01', '2026-09-30').valid).toBe(true);
      expect(validateDateRange('2026-09-15', '2026-09-15').valid).toBe(true); // same day
      const res = validateDateRange('2026-10-01', '2026-09-01');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('End date must be on or after the start date');
    });
  });

  describe('9. Notes and Text Validation', () => {
    it('should accept notes under 1000 characters', () => {
      expect(validateNotes('Normal note text').valid).toBe(true);
      expect(validateNotes('A'.repeat(1000)).valid).toBe(true);
    });

    it('should reject notes exceeding 1000 characters', () => {
      const res = validateNotes('A'.repeat(1001));
      expect(res.valid).toBe(false);
      expect(res.error).toContain('cannot exceed 1000 characters');
    });

    it('should validate flock identifiers and breed types', () => {
      expect(validateFlockName('Flock 1').valid).toBe(true);
      expect(validateFlockName('A'.repeat(101)).valid).toBe(false);
      expect(validateBreedType('BV-380').valid).toBe(true);
      expect(validateBreedType('A'.repeat(51)).valid).toBe(false);
    });
  });
});
