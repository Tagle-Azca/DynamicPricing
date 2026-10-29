import jwt from 'jsonwebtoken';
import { AppError } from '../errors/AppError';
import { tokenPayloadSchema } from '../dtos/auth.dto';
import type { Principal } from '../dtos/auth.dto';
import type { AppConfig } from '../config/appConfig';

export interface TokenService {
  sign(principal: Principal): string;
  verify(token: string): Principal;
  readonly ttlSeconds: number;
}

type TokenConfig = Pick<AppConfig, 'jwtSecret' | 'jwtTtlSeconds' | 'jwtIssuer' | 'jwtAudience'>;

function invalid(): AppError {
  return new AppError(401, 'TOKEN_INVALID', 'Invalid access token');
}

export function createTokenService(cfg: TokenConfig): TokenService {
  return {
    ttlSeconds: cfg.jwtTtlSeconds,
    sign(principal: Principal): string {
      return jwt.sign({ role: principal.role }, cfg.jwtSecret, {
        algorithm: 'HS256',
        expiresIn: cfg.jwtTtlSeconds,
        issuer: cfg.jwtIssuer,
        audience: cfg.jwtAudience,
        subject: principal.sub,
      });
    },
    verify(token: string): Principal {
      let decoded: string | jwt.JwtPayload;
      try {
        decoded = jwt.verify(token, cfg.jwtSecret, {
          algorithms: ['HS256'],
          issuer: cfg.jwtIssuer,
          audience: cfg.jwtAudience,
        });
      } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
          throw new AppError(401, 'TOKEN_EXPIRED', 'Access token expired');
        }
        throw invalid();
      }
      const parsed = tokenPayloadSchema.safeParse(decoded);
      if (!parsed.success) throw invalid();
      return parsed.data;
    },
  };
}
