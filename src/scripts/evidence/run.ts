import type { Server } from 'node:http';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { connectDatabase, disconnectDatabase } from '../../config/database';
import { seedDatabase } from '../seed';
import { createApp } from '../../app';
import { Harness } from './harness';
import { writeReport } from './report';
import { runPricingScenarios } from './pricing.scenarios';
import { runConcurrencyScenario, runCouponScenarios } from './coupon.scenarios';
import { runImmutabilityScenario } from './immutability.scenario';
import { runBootSmoke } from './bootSmoke.scenario';

async function listen(): Promise<{ server: Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = createApp().listen(0, () => {
      const { port } = server.address() as { port: number };
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

async function main(): Promise<number> {
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  let server: Server | undefined;
  try {
    const uri = replSet.getUri('dynamic_pricing_evidence');
    await connectDatabase(uri);
    await seedDatabase();
    const started = await listen();
    server = started.server;
    const h = new Harness(started.baseUrl);

    await runPricingScenarios(h);
    await runCouponScenarios(h);
    await runConcurrencyScenario(h);
    await runImmutabilityScenario(h);
    await runBootSmoke(h, uri);

    const file = await writeReport(h.records);
    const failed = h.records.filter((r) => !r.pass).length;
    console.log(
      `\n${h.records.length - failed}/${h.records.length} scenarios passed. Report: ${file}`,
    );
    return failed === 0 ? 0 : 1;
  } finally {
    if (server) await new Promise<void>((r) => server?.close(() => r()));
    await disconnectDatabase();
    await replSet.stop();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error('Evidence run failed:', err);
    process.exit(1);
  });
