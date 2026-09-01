import { z } from 'zod';

const envSchema = z
  .object({
    FIREBASE_PROJECT_ID: z.string().min(1),
    FIREBASE_SERVICE_ACCOUNT_PATH: z.string().default('./service-account.json'),
    PORT: z.coerce.number().default(3000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  })
  .superRefine((data, ctx) => {
    const origins = data.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
    if (data.NODE_ENV === 'production') {
      for (const origin of origins) {
        if (origin === '*' || origin === 'null') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'ALLOWED_ORIGINS must not contain wildcards in production',
          });
        }
      }
    }
  });

export type Environment = z.infer<typeof envSchema>;

let _env: Environment | null = null;

export function getEnv(): Environment {
  if (!_env) {
    _env = envSchema.parse(process.env);
  }
  return _env;
}

export function loadEnvForTest(overrides: Partial<Environment>): Environment {
  _env = envSchema.parse({
    FIREBASE_PROJECT_ID: 'test-project',
    FIREBASE_SERVICE_ACCOUNT_PATH: './test-service-account.json',
    PORT: 3000,
    NODE_ENV: 'test',
    ALLOWED_ORIGINS: 'http://localhost:3000',
    RATE_LIMIT_WINDOW_MS: 900000,
    RATE_LIMIT_MAX_REQUESTS: 100,
    LOG_LEVEL: 'info',
    ...overrides,
  });
  return _env;
}
