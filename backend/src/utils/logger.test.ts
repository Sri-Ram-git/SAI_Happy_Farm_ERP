import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../utils/logger';

describe('Logger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should log info messages as JSON', () => {
    logger.info('test message', { key: 'value' });
    expect(consoleSpy).toHaveBeenCalled();
    const callArgs = consoleSpy.mock.calls[0];
    expect(callArgs).toBeDefined();
    const logOutput = JSON.parse(callArgs![0] as string);
    expect(logOutput.level).toBe('info');
    expect(logOutput.message).toBe('test message');
    expect(logOutput.key).toBe('value');
    expect(logOutput.timestamp).toBeDefined();
  });

  it('should redact passwords, tokens, and authorization keys', () => {
    logger.info('auth event', {
      password: 'superSecretPassword',
      token: 'jwt-access-token-sample',
      idToken: 'sample-id-token',
      refreshToken: 'sample-refresh-token',
      authorization: 'Bearer sample-secret-token',
      apiKey: 'api-key-value',
      normalKey: 'safe-value',
    });
    expect(consoleSpy).toHaveBeenCalled();
    const callArgs = consoleSpy.mock.calls[0];
    expect(callArgs).toBeDefined();
    const logOutput = JSON.parse(callArgs![0] as string);
    expect(logOutput.password).toBe('[REDACTED]');
    expect(logOutput.token).toBe('[REDACTED]');
    expect(logOutput.idToken).toBe('[REDACTED]');
    expect(logOutput.refreshToken).toBe('[REDACTED]');
    expect(logOutput.authorization).toBe('[REDACTED]');
    expect(logOutput.apiKey).toBe('[REDACTED]');
    expect(logOutput.normalKey).toBe('safe-value');
  });

  it('should redact sensitive keys inside nested objects and arrays', () => {
    logger.info('nested payload', {
      user: {
        email: 'user@example.com',
        credentials: {
          password: 'myPassword123',
          privateKey: 'private-key-material',
        },
      },
      tokens: ['token1', { secret: 'nestedSecret' }],
    });
    const callArgs = consoleSpy.mock.calls[0];
    const logOutput = JSON.parse(callArgs![0] as string);
    expect(logOutput.user.email).toBe('user@example.com');
    expect(logOutput.user.credentials).toBe('[REDACTED]');
    expect(logOutput.tokens[1].secret).toBe('[REDACTED]');
  });

  it('should redact Bearer tokens inside raw string messages', () => {
    logger.warn('Failed attempt with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDReBgm6ClZW1CQdtNeXK4m1g58a', {
      ip: '127.0.0.1',
    });
    const callArgs = vi.mocked(console.warn).mock.calls[0];
    const logOutput = JSON.parse(callArgs![0] as string);
    expect(logOutput.message).toContain('Bearer [REDACTED]');
    expect(logOutput.message).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
  });

  it('should not mutate the caller original metadata object', () => {
    const originalMeta = {
      password: 'unmutatedPassword',
      user: { token: 'unmutatedToken' },
    };
    logger.info('mutation test', originalMeta);
    expect(originalMeta.password).toBe('unmutatedPassword');
    expect(originalMeta.user.token).toBe('unmutatedToken');
  });
});
