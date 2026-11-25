import { loadEnv } from '../config/env';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { initModels } from '../models';
import { User } from '../models/user.model';
import { tierSchema } from '../dtos/auth.dto';
import type { Tier } from '../dtos/auth.dto';

/** Sets a demo customer tier. Returns false when no user has that email. */
export async function setUserTier(email: string, tier: Tier): Promise<boolean> {
  const result = await User.updateOne({ email: email.trim().toLowerCase() }, { $set: { tier } });
  return result.matchedCount === 1;
}

async function main(): Promise<number> {
  const [email, rawTier] = process.argv.slice(2);
  const tier = tierSchema.safeParse(rawTier);
  if (!email || !tier.success) {
    console.error('Usage: npm run set-tier -- <email> <standard|gold|platinum>');
    return 1;
  }
  const env = loadEnv();
  await connectDatabase(env.MONGODB_URI);
  try {
    await initModels();
    if (!(await setUserTier(email, tier.data))) {
      console.error('No user with that email');
      return 1;
    }
    console.log(`Tier set to ${tier.data}`);
    return 0;
  } finally {
    await disconnectDatabase();
  }
}

if (require.main === module) {
  main()
    .then((code) => process.exit(code))
    .catch((err: unknown) => {
      console.error('set-tier failed:', err);
      process.exit(1);
    });
}
