import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { getEnv, loadEnvForTest } from './config/environment';
import { initializeFirebase } from './config/firebase';
import { generateRequestId } from './utils/requestId';
import { errorMiddleware } from './middleware/error.middleware';
import { rateLimitMiddleware } from './middleware/rateLimit.middleware';
import reportsRouter from './routes/reports.routes';
import farmsRouter from './routes/farms.routes';
import adminRouter from './routes/admin.routes';
import flockRouter from './routes/flock.routes';
import { logger } from './utils/logger';

function createApp(): express.Express {
  if (process.env['NODE_ENV'] === 'test') {
    loadEnvForTest({});
  }

  const env = getEnv();
  initializeFirebase();

  const app = express();
  app.set('trust proxy', 1);

  const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());

  app.use(helmet());
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (env.NODE_ENV === 'development') {
        if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
          return callback(null, true);
        }
      }

      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
  }));


  app.use(express.json({ limit: '10mb' }));

  app.use((req, _res, next) => {
    req.requestId = generateRequestId();
    next();
  });

  app.use(rateLimitMiddleware);

  app.use('/api/v1/reports', reportsRouter);
  app.use('/api/v1/farms', farmsRouter);
  app.use('/api/v1/flocks', flockRouter);
  app.use('/api/v1/admin', adminRouter);

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.get('/', (_req, res) => {
    res.status(200).json({ name: 'SAI Happy Farms API', version: '1.0.0', status: 'running' });
  });

  app.use(errorMiddleware);

  return app;
}

if (require.main === module) {
  const app = createApp();
  const env = getEnv();

  app.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`SAI Happy Farms API running on port ${env.PORT}`, {
      environment: env.NODE_ENV,
    });
  });
}

export { createApp };
