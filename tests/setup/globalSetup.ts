import { MongoMemoryReplSet } from 'mongodb-memory-server';

declare module 'vitest' {
  export interface ProvidedContext {
    mongoUri: string;
  }
}

export default async function setup(project: {
  provide(key: 'mongoUri', value: string): void;
}): Promise<() => Promise<void>> {
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  project.provide('mongoUri', replSet.getUri());
  return async (): Promise<void> => {
    await replSet.stop();
  };
}
