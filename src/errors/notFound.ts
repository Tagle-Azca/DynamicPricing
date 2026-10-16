import type { Request, Response, NextFunction } from 'express';
import { AppError } from './AppError';

export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(404, 'ROUTE_NOT_FOUND', `Route ${req.method} ${req.path} not found`));
}
