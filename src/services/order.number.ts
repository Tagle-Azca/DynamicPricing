import { randomInt } from 'node:crypto';

// No 0/O/1/I: order numbers get read aloud and typed by people.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LENGTH = 8;

export function generateOrderNumber(): string {
  let code = '';
  for (let i = 0; i < LENGTH; i += 1) code += ALPHABET[randomInt(ALPHABET.length)];
  return `DP-${code}`;
}
