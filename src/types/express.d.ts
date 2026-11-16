import type { Principal } from '../dtos/auth.dto';

declare global {
  namespace Express {
    interface Request {
      auth?: Principal;
    }
  }
}

export {};
