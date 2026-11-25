import { User } from '../models/user.model';
import type { Tier } from '../dtos/auth.dto';

/** Customer tier is server-side state: read from the user document, never from the client. */
export async function getUserTier(userId: string): Promise<Tier> {
  const user = await User.findOne({ _id: userId }).select('tier').lean();
  return user?.tier ?? 'standard';
}
