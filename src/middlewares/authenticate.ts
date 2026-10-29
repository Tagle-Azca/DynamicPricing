import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { AppError } from '../errors/AppError';
import type { TokenService } from '../services/token.service';

const BEARER = /^Bearer ([A-Za-z0-9\-._~+/]+=*)$/;

function challenge(res: Response): void {
  res.setHeader('WWW-Authenticate', 'Bearer');
}

export function authenticate(tokens: TokenService): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const match = BEARER.exec(req.headers.authorization ?? '');
    if (!match?.[1]) {
      challenge(res);
      next(new AppError(401, 'AUTH_REQUIRED', 'Authentication required'));
      return;
    }
    try {
      req.auth = tokens.verify(match[1]);
      next();
    } catch (err) {
      challenge(res);
      next(err);
    }
  };
}
