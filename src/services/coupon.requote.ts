import type { ClientSession } from 'mongoose';
import { releaseOne } from './coupon.release';

/**
 * Re-quoting the same cart with the same code gives the old reservation back before a fresh
 * one is issued, inside the caller's transaction, so no extra use is consumed. A different
 * code is left alone and later rejected as COUPON_ALREADY_APPLIED by the reserve step.
 */
export async function releaseSameCodeReservation(
  input: { code: string; userId: string; cartId: string; now: Date },
  session: ClientSession,
): Promise<void> {
  const { code, userId, cartId, now } = input;
  await releaseOne({ couponCode: code, userId, cartId }, session, now);
}
