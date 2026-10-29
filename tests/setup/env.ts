import { randomBytes } from 'node:crypto';

process.env.JWT_SECRET ??= randomBytes(32).toString('hex');
process.env.BCRYPT_ROUNDS = '10';
process.env.NODE_ENV = 'test';
