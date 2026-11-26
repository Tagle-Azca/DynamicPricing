import { Harness, dig } from './harness';
import { Coupon } from '../../models/coupon.model';
import { CouponReservation } from '../../models/couponReservation.model';
import { releaseExpiredReservations } from '../../services/coupon.release';

const CALCULATE = '/api/v1/pricing/calculate';

function cartWithCoupon(cartId: string): unknown {
  return {
    cartId,
    items: [{ sku: 'SKU-LAPTOP', quantity: 1 }],
    context: { currency: 'USD' },
    couponCode: 'LASTONE',
  };
}

async function remainingUses(code: string): Promise<number | undefined> {
  return (await Coupon.findOne({ code }).lean())?.remainingUses;
}

export async function runReservationScenarios(h: Harness): Promise<void> {
  const body = cartWithCoupon('cart-r1');
  const calc = await h.http('POST', CALCULATE, body);
  const total = dig(calc.body, 'data', 'total');
  const discount = dig(calc.body, 'data', 'coupon', 'discountAmount');
  const reservationId = String(dig(calc.body, 'data', 'coupon', 'reservationId'));
  h.record({
    name: 'Calculate with couponCode (reservation and audit in one transaction)',
    method: 'POST',
    path: CALCULATE,
    requestBody: body,
    status: calc.status,
    responseBody: calc.body,
    expected: '200, coupon LASTONE reserved, finalTotal = total - discountAmount, remainingUses 0',
    pass:
      calc.status === 200 &&
      typeof total === 'number' &&
      typeof discount === 'number' &&
      dig(calc.body, 'data', 'finalTotal') === total - discount &&
      dig(calc.body, 'data', 'coupon', 'remainingUses') === 0,
  });

  const exhausted = await h.http('POST', CALCULATE, cartWithCoupon('cart-r2'));
  h.record({
    name: 'Calculate with the same coupon after it ran out',
    method: 'POST',
    path: CALCULATE,
    requestBody: cartWithCoupon('cart-r2'),
    status: exhausted.status,
    responseBody: exhausted.body,
    expected: '409 COUPON_EXHAUSTED, no audit written',
    pass: exhausted.status === 409 && dig(exhausted.body, 'error', 'code') === 'COUPON_EXHAUSTED',
  });

  const path = `/api/v1/coupons/reservations/${reservationId}`;
  const released = await h.http('DELETE', path);
  h.record({
    name: 'Release the reservation (restores one use)',
    method: 'DELETE',
    path,
    status: released.status,
    responseBody: released.body,
    expected: '200 RELEASED, remainingUses 1',
    pass: released.status === 200 && dig(released.body, 'data', 'remainingUses') === 1,
  });
  const again = await h.http('DELETE', path);
  h.record({
    name: 'Release the same reservation twice',
    method: 'DELETE',
    path,
    status: again.status,
    responseBody: again.body,
    expected: '409 RESERVATION_NOT_ACTIVE, remainingUses stays 1',
    pass:
      again.status === 409 &&
      dig(again.body, 'error', 'code') === 'RESERVATION_NOT_ACTIVE' &&
      (await remainingUses('LASTONE')) === 1,
  });

  const second = await h.http('POST', CALCULATE, cartWithCoupon('cart-r3'));
  await CouponReservation.updateMany(
    { status: 'RESERVED', couponCode: 'LASTONE' },
    {
      $set: { expiresAt: new Date(Date.now() - 1000) },
    },
  );
  const swept = await releaseExpiredReservations();
  const sweptAgain = await releaseExpiredReservations();
  h.record({
    name: 'Expiry sweeper releases an expired reservation (idempotent)',
    method: 'SERVICE',
    path: 'releaseExpiredReservations()',
    responseBody: {
      reservedStatus: second.status,
      firstSweep: swept,
      secondSweep: sweptAgain,
      remainingUses: await remainingUses('LASTONE'),
    },
    expected: 'first sweep releases 1, second 0, remainingUses back to 1 (maxUses)',
    pass:
      second.status === 200 &&
      swept === 1 &&
      sweptAgain === 0 &&
      (await remainingUses('LASTONE')) === 1,
  });
}
