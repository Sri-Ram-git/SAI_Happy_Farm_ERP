import { describe, it, expect } from 'vitest';

export interface FarmerFormState {
  name: string;
  email: string;
  phone_no: string;
  password: string;
  confirmPassword: string;
  farmName: string;
  initialBirdCount: string;
  initialFeedKg: string;
}

export function validateFarmerForm(form: FarmerFormState): Record<string, string> {
  const errs: Record<string, string> = {};

  if (!form.name.trim()) errs.name = 'Full name is required';
  if (!form.email.trim()) errs.email = 'Email address is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email format';

  if (!form.phone_no.trim()) errs.phone_no = 'Phone number is required';

  if (!form.password) errs.password = 'Password is required';
  else if (form.password.length < 6) errs.password = 'Password must be at least 6 characters';

  if (!form.confirmPassword) errs.confirmPassword = 'Please confirm password';
  else if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';

  if (!form.farmName.trim()) errs.farmName = 'Farm name is required';

  if (form.initialBirdCount !== '') {
    const birds = Number(form.initialBirdCount);
    if (isNaN(birds) || birds < 0) {
      errs.initialBirdCount = 'Cannot be negative';
    } else if (!Number.isInteger(birds)) {
      errs.initialBirdCount = 'Initial bird count must be a whole number';
    }
  }

  if (form.initialFeedKg !== '') {
    const feed = Number(form.initialFeedKg);
    if (isNaN(feed) || feed < 0) {
      errs.initialFeedKg = 'Cannot be negative';
    }
  }

  return errs;
}

describe('Admin Create Farmer Form Validation Suite', () => {
  const validForm: FarmerFormState = {
    name: 'Suresh Kumar',
    email: 'suresh@saihappyfarms.com',
    phone_no: '9848099999',
    password: 'password123',
    confirmPassword: 'password123',
    farmName: 'Sai Bhavani Farm',
    initialBirdCount: '1000',
    initialFeedKg: '250',
  };

  it('should pass validation for complete valid form', () => {
    const errors = validateFarmerForm(validForm);
    expect(Object.keys(errors).length).toBe(0);
  });

  it('should pass validation with zero initial birds and zero initial feed', () => {
    const errors = validateFarmerForm({
      ...validForm,
      initialBirdCount: '0',
      initialFeedKg: '0',
    });
    expect(Object.keys(errors).length).toBe(0);
  });

  it('should pass validation with decimal initial feed stock (e.g. 250.5 kg)', () => {
    const errors = validateFarmerForm({
      ...validForm,
      initialFeedKg: '250.5',
    });
    expect(errors.initialFeedKg).toBeUndefined();
  });

  it('should reject fractional/decimal initial bird count (e.g. 500.5 birds)', () => {
    const errors = validateFarmerForm({
      ...validForm,
      initialBirdCount: '500.5',
    });
    expect(errors.initialBirdCount).toBeDefined();
    expect(errors.initialBirdCount).toBe('Initial bird count must be a whole number');
  });

  it('should reject negative initial bird count', () => {
    const errors = validateFarmerForm({
      ...validForm,
      initialBirdCount: '-50',
    });
    expect(errors.initialBirdCount).toBeDefined();
    expect(errors.initialBirdCount).toBe('Cannot be negative');
  });

  it('should reject negative initial feed stock', () => {
    const errors = validateFarmerForm({
      ...validForm,
      initialFeedKg: '-10',
    });
    expect(errors.initialFeedKg).toBeDefined();
    expect(errors.initialFeedKg).toBe('Cannot be negative');
  });

  it('should reject mismatched password and confirm password', () => {
    const errors = validateFarmerForm({
      ...validForm,
      confirmPassword: 'different-password',
    });
    expect(errors.confirmPassword).toBe('Passwords do not match');
  });

  it('should reject missing farm name', () => {
    const errors = validateFarmerForm({
      ...validForm,
      farmName: '   ',
    });
    expect(errors.farmName).toBe('Farm name is required');
  });
});
