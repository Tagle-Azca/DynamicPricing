import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { AppError } from '../errors/AppError';
import type { Role } from '../dtos/auth.dto';

export function requireRole(...roles: Role[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.setHeader('WWW-Authenticate', 'Bearer');
      next(new AppError(401, 'AUTH_REQUIRED', 'Authentication required'));
      return;
    }
    if (!roles.includes(req.auth.role)) {
      next(new AppError(403, 'FORBIDDEN', 'Insufficient permissions'));
      return;
    }
    next();
  };
}
