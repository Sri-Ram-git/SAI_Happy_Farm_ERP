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
import { logger } from './utils/logger';

function createApp(): express.Express {
  if (process.env['NODE_ENV'] === 'test') {
    loadEnvForTest({});
  }

  const env = getEnv();
  initializeFirebase();

  const app = express();
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({
    origin: env.ALLOWED_ORIGINS.split(','),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }));

  app.use(express.json({ limit: '100kb' }));

  app.use((req, _res, next) => {
    req.requestId = generateRequestId();
    next();
  });

  app.use(rateLimitMiddleware);

  app.use('/api/v1/reports', reportsRouter);
  app.use('/api/v1/farms', farmsRouter);
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

  app.listen(env.PORT, () => {
    logger.info(`SAI Happy Farms API running on port ${env.PORT}`, {
      environment: env.NODE_ENV,
    });
  });
}

export { createApp };
