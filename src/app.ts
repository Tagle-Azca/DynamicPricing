import path from 'node:path';
import express from 'express';
import type { Express, Request, Response } from 'express';
import helmet from 'helmet';
import { createApiRouter } from './routes';
import { notFound } from './errors/notFound';
import { errorHandler } from './errors/errorHandler';
import { databaseState } from './config/database';
import type { AppConfig } from './config/appConfig';
import { IMAGE_HOST, cloudName } from './config/imageHost';
import { createCors } from './middlewares/cors';
import { createLimiters } from './middlewares/rateLimiters';
import { rejectOperatorKeys } from './middlewares/rejectOperatorKeys';
import { createTokenService } from './services/token.service';

/** Images may come from our own Cloudinary cloud only (path-scoped); none when it is unset. */
function imageSources(): string[] {
  const cloud = cloudName();
  return cloud ? ["'self'", 'data:', `https://${IMAGE_HOST}/${cloud}/`] : ["'self'", 'data:'];
}

export function createApp(config: AppConfig): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('query parser', 'simple');
  app.set('trust proxy', config.trustProxy);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'img-src': imageSources(),
        },
      },
    }),
  );
  app.use(express.static(path.resolve(__dirname, '..', 'public')));
  app.use(createCors(config.corsOrigins));
  const limiters = createLimiters(config);
  app.use(limiters.global);
  app.use(express.json({ limit: '100kb', strict: true }));
  app.use(rejectOperatorKeys);

  app.get('/health', (_req: Request, res: Response) => {
    const database = databaseState();
    res.status(database === 'connected' ? 200 : 503).json({
      data: { status: database === 'connected' ? 'ok' : 'degraded', database },
    });
  });
  const tokens = createTokenService(config);
  app.use(
    '/api/v1',
    createApiRouter({
      tokens,
      limiters,
      bcryptRounds: config.bcryptRounds,
      reservationTtlSeconds: config.reservationTtlSeconds,
      auditQuoteTtlSeconds: config.auditQuoteTtlSeconds,
    }),
  );
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
