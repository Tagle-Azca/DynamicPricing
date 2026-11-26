import type { Request, Response } from 'express';
import type { AuthService } from '../services/auth.service';
import type { LoginRequest, RegisterRequest } from '../dtos/auth.dto';
import { getUserTier } from '../services/user.tier';
import { AppError } from '../errors/AppError';

export interface AuthController {
  register(req: Request, res: Response): Promise<void>;
  login(req: Request, res: Response): Promise<void>;
  me(req: Request, res: Response): Promise<void>;
}

export function createAuthController(service: AuthService): AuthController {
  return {
    async register(req, res): Promise<void> {
      const data = await service.register(req.body as RegisterRequest);
      res.status(201).json({ data });
    },
    async login(req, res): Promise<void> {
      const data = await service.login(req.body as LoginRequest);
      res.status(200).json({ data });
    },
    async me(req, res): Promise<void> {
      if (!req.auth) throw new AppError(401, 'AUTH_REQUIRED', 'Authentication required');
      res.status(200).json({ data: { ...req.auth, tier: await getUserTier(req.auth.sub) } });
    },
  };
}
