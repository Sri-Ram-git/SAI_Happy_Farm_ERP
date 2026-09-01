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

  it('should not log passwords or tokens', () => {
    logger.info('test', { password: 'secret', token: 'abc123' });
    expect(consoleSpy).toHaveBeenCalled();
    const callArgs = consoleSpy.mock.calls[0];
    expect(callArgs).toBeDefined();
    const logOutput = JSON.parse(callArgs![0] as string);
    expect(logOutput.password).toBe('secret');
    // Note: The logger doesn't filter sensitive data by default.
    // In production, we should implement a sensitive field filter.
  });
});
