import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';

type Source = 'body' | 'params';

export function validate(source: Source, schema: ZodTypeAny): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(result.error);
      return;
    }
    (req as unknown as Record<Source, unknown>)[source] = result.data;
    next();
  };
}
