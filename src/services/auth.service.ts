import { randomBytes } from 'node:crypto';
import { User } from '../models/user.model';
import { AppError } from '../errors/AppError';
import type { LoginRequest, LoginResponse, PublicUser, RegisterRequest } from '../dtos/auth.dto';
import { hashPassword, verifyPassword } from './password.service';
import { createUser } from './user.service';
import type { TokenService } from './token.service';

export interface AuthService {
  register(request: RegisterRequest): Promise<PublicUser>;
  login(request: LoginRequest): Promise<LoginResponse>;
}

export function createAuthService(tokens: TokenService, rounds: number): AuthService {
  let dummyHash: Promise<string> | undefined;
  const getDummyHash = (): Promise<string> => {
    dummyHash ??= hashPassword(randomBytes(16).toString('hex'), rounds);
    return dummyHash;
  };

  return {
    register: (request) => createUser(request.email, request.password, 'customer', rounds),

    async login(request): Promise<LoginResponse> {
      const user = await User.findOne({ email: request.email }).select('+passwordHash');
      const hash = user ? user.passwordHash : await getDummyHash();
      const matches = await verifyPassword(request.password, hash);
      if (!user || !matches) {
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
      }
      const principal = { sub: String(user._id), role: user.role };
      return {
        accessToken: tokens.sign(principal),
        tokenType: 'Bearer',
        expiresIn: tokens.ttlSeconds,
        user: { id: principal.sub, email: user.email, role: user.role, tier: user.tier },
      };
    },
  };
}
