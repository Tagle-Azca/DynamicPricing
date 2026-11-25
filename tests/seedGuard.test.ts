import { describe, expect, it } from 'vitest';
import { parseMongoTarget, seedRefusal } from '../src/scripts/seedGuard';

const LOCAL = 'mongodb://localhost:27018/dynamic_pricing?replicaSet=rs0';
const ATLAS = 'mongodb+srv://user:pw@cluster0.abcde.mongodb.net/prod?retryWrites=true';

describe('seed guard', () => {
  it('allows a local development database', () => {
    expect(seedRefusal('development', LOCAL, false)).toBeNull();
  });
  it('refuses production even on a local host', () => {
    expect(seedRefusal('production', LOCAL, false)).toMatch(/production/);
  });
  it('refuses a remote host', () => {
    expect(seedRefusal('development', ATLAS, false)).toMatch(/not local/);
  });
  it('refuses a replica set when any host is remote', () => {
    expect(seedRefusal('development', 'mongodb://localhost:1,db.example.com:2/x', false)).toMatch(
      /not local/,
    );
  });
  it('refuses an unparseable uri', () => {
    expect(seedRefusal('development', 'nonsense', false)).toMatch(/not local/);
  });
  it('--force overrides', () => {
    expect(seedRefusal('production', ATLAS, true)).toBeNull();
  });
  it('parses host and database', () => {
    expect(parseMongoTarget(ATLAS)).toEqual({
      hosts: ['cluster0.abcde.mongodb.net'],
      database: 'prod',
    });
  });
});
