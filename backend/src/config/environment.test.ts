import { describe, it, expect, beforeEach } from 'vitest';
import { loadEnvForTest } from '../config/environment';

describe('Environment Config', () => {
  beforeEach(() => {
    process.env['FIREBASE_PROJECT_ID'] = 'test-project';
    process.env['NODE_ENV'] = 'test';
  });

  it('should load default values for test', () => {
    const env = loadEnvForTest({});
    expect(env.FIREBASE_PROJECT_ID).toBe('test-project');
    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe('test');
    expect(env.RATE_LIMIT_WINDOW_MS).toBe(900000);
    expect(env.RATE_LIMIT_MAX_REQUESTS).toBe(100);
  });

  it('should allow overriding values', () => {
    const env = loadEnvForTest({ PORT: 4000 });
    expect(env.PORT).toBe(4000);
  });
});
