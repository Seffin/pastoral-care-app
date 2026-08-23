import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Pool } from 'pg';

import { authRouter } from './api/auth.routes';
import { membersRouter } from './api/members.routes';
import { visitsRouter } from './api/visits.routes';
import { attendanceRouter } from './api/attendance.routes';
import { requireAuth } from './middleware/requireAuth';
import { errorHandler } from './middleware/errorHandler';

export function createApp(pool: Pool) {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') ?? [] }));
  app.use(express.json({ limit: '1mb' }));

  // Blanket API rate limit; auth routes get a stricter limit inside auth.routes.ts
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  app.locals.pool = pool;

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/api/auth', authRouter);
  app.use('/api/members', requireAuth, membersRouter);
  app.use('/api/visits', requireAuth, visitsRouter);
  app.use('/api/attendance', requireAuth, attendanceRouter);

  app.use(errorHandler);

  return app;
}
