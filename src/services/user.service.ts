import { User } from '../models/user.model';
import { AppError } from '../errors/AppError';
import type { PublicUser, Role } from '../dtos/auth.dto';
import { hashPassword } from './password.service';

export async function createUser(
  email: string,
  password: string,
  role: Role,
  rounds: number,
): Promise<PublicUser> {
  const passwordHash = await hashPassword(password, rounds);
  try {
    const doc = await User.create({ email, passwordHash, role });
    return { id: String(doc._id), email: doc.email, role: doc.role };
  } catch (err) {
    if ((err as { code?: unknown }).code === 11000) {
      throw new AppError(409, 'EMAIL_TAKEN', 'Email is already registered');
    }
    throw err;
  }
}
