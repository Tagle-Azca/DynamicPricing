import express from 'express';
import type { Express, Request, Response } from 'express';
import helmet from 'helmet';
import { apiRouter } from './routes';
import { notFound } from './errors/notFound';
import { errorHandler } from './errors/errorHandler';
import { databaseState } from './config/database';

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req: Request, res: Response) => {
    const database = databaseState();
    res.status(database === 'connected' ? 200 : 503).json({
      data: { status: database === 'connected' ? 'ok' : 'degraded', database },
    });
  });
  app.use('/api/v1', apiRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
