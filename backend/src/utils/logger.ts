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

const SENSITIVE_KEY_PATTERNS: RegExp[] = [
  /^password$/i,
  /^confirm_?password$/i,
  /^new_?password$/i,
  /^old_?password$/i,
  /^token$/i,
  /^[a-z0-9_]*token$/i,
  /^authorization$/i,
  /^secret$/i,
  /^[a-z0-9_]*secret$/i,
  /^api_?key$/i,
  /^private_?key$/i,
  /^credentials?$/i,
  /^service_?account$/i,
  /^session_?id$/i,
  /^cookie$/i,
  /^set-cookie$/i,
];

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function sanitizeString(str: string): string {
  return str.replace(/Bearer\s+[A-Za-z0-9-_.~+/]+=*/gi, 'Bearer [REDACTED]');
}

export function sanitizeLogData(val: unknown, seen = new WeakSet()): unknown {
  if (val === null || val === undefined) {
    return val;
  }

  if (typeof val === 'string') {
    return sanitizeString(val);
  }

  if (typeof val !== 'object') {
    return val;
  }

  if (val instanceof Date) {
    return val.toISOString();
  }

  if (val instanceof Error) {
    return {
      name: val.name,
      message: sanitizeString(val.message),
      stack: val.stack ? sanitizeString(val.stack) : undefined,
    };
  }

  if (seen.has(val)) {
    return '[CIRCULAR]';
  }
  seen.add(val);

  if (Array.isArray(val)) {
    return val.map((item) => sanitizeLogData(item, seen));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(val as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizeLogData(value, seen);
    }
  }

  return sanitized;
}

function formatLog(entry: LogEntry): string {
  const sanitized = sanitizeLogData(entry);
  return JSON.stringify(sanitized);
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
