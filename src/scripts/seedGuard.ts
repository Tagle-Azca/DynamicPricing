const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export interface SeedTarget {
  hosts: string[];
  database: string;
}

export function parseMongoTarget(uri: string): SeedTarget {
  const match = /^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)(?:\/([^?]*))?/.exec(uri);
  const hostList = match?.[1] ?? '';
  const hosts = hostList
    .split(',')
    .map((h) => h.replace(/:\d+$/, '').toLowerCase())
    .filter(Boolean);
  return { hosts, database: match?.[2] ?? '' };
}

/**
 * Seed deletes products, campaigns, coupons and reservations.
 * Returns a refusal reason, or null when it is safe to run.
 */
export function seedRefusal(nodeEnv: string, uri: string, force: boolean): string | null {
  if (force) return null;
  if (nodeEnv === 'production') return 'NODE_ENV=production';
  const { hosts } = parseMongoTarget(uri);
  if (hosts.length === 0 || !hosts.every((h) => LOCAL_HOSTS.has(h))) {
    return 'database host is not local';
  }
  return null;
}
