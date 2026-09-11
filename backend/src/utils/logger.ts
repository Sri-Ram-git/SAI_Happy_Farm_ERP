type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

interface LogEntry {
  level: string;
  timestamp: string;
  message: string;
  requestId?: string;
  userId?: string;
  method?: string;
  endpoint?: string;
  statusCode?: number;
  latencyMs?: number;
  errorCode?: string;
  [key: string]: unknown;
}

function getConfiguredLogLevel(): LogLevel {
  const raw = process.env['LOG_LEVEL'];
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') {
    return raw;
  }
  return 'info';
}

function shouldLog(level: LogLevel): boolean {
  const configLevel = LOG_LEVELS[getConfiguredLogLevel()];
  return LOG_LEVELS[level] >= configLevel;
}

function formatLog(entry: LogEntry): string {
  return JSON.stringify(entry);
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>): void {
    if (!shouldLog('debug')) return;
    console.debug(
      formatLog({
        level: 'debug',
        timestamp: new Date().toISOString(),
        message,
        ...meta,
      }),
    );
  },

  info(message: string, meta?: Record<string, unknown>): void {
    if (!shouldLog('info')) return;
    console.info(
      formatLog({
        level: 'info',
        timestamp: new Date().toISOString(),
        message,
        ...meta,
      }),
    );
  },

  warn(message: string, meta?: Record<string, unknown>): void {
    if (!shouldLog('warn')) return;
    console.warn(
      formatLog({
        level: 'warn',
        timestamp: new Date().toISOString(),
        message,
        ...meta,
      }),
    );
  },

  error(message: string, meta?: Record<string, unknown>): void {
    if (!shouldLog('error')) return;
    console.error(
      formatLog({
        level: 'error',
        timestamp: new Date().toISOString(),
        message,
        ...meta,
      }),
    );
  },
};
