import { Router } from 'express';
import type { RequestHandler } from 'express';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../middlewares/asyncHandler';
import { registerSchema, loginSchema } from '../dtos/auth.dto';
import type { AuthController } from '../controllers/auth.controller';

export interface AuthRouteDeps {
  controller: AuthController;
  authLimiter: RequestHandler;
  authenticate: RequestHandler;
}

export function createAuthRouter(deps: AuthRouteDeps): Router {
  const router = Router();
  const { controller } = deps;
  router.post(
    '/register',
    deps.authLimiter,
    validate('body', registerSchema),
    asyncHandler((req, res) => controller.register(req, res)),
  );
  router.post(
    '/login',
    deps.authLimiter,
    validate('body', loginSchema),
    asyncHandler((req, res) => controller.login(req, res)),
  );
  router.get(
    '/me',
    deps.authenticate,
    asyncHandler((req, res) => controller.me(req, res)),
  );
  return router;
}
