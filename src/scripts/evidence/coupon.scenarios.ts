import { Harness, dig } from './harness';
import { Coupon } from '../../models/coupon.model';
import { CouponReservation } from '../../models/couponReservation.model';

const APPLY = '/api/v1/coupons/apply';

async function expectApply(
  h: Harness,
  name: string,
  body: unknown,
  status: number,
  code?: string,
): Promise<void> {
  const res = await h.http('POST', APPLY, body);
  const gotCode = dig(res.body, 'error', 'code');
  h.record({
    name,
    method: 'POST',
    path: APPLY,
    requestBody: body,
    status: res.status,
    responseBody: res.body,
    expected: code ? `${status} ${code}` : `${status} RESERVED`,
    pass:
      res.status === status &&
      (code ? gotCode === code : dig(res.body, 'data', 'status') === 'RESERVED'),
  });
}

export async function runCouponScenarios(h: Harness): Promise<void> {
  const ok = { code: 'WELCOME10', cartId: 'cart-c1', subtotal: 20000 };
  await expectApply(h, 'Apply coupon (transaction, reserved)', ok, 200);
  await expectApply(h, 'Apply same coupon to same cart again', ok, 409, 'COUPON_ALREADY_APPLIED');
  await expectApply(
    h,
    'Apply expired coupon',
    { code: 'EXPIRED20', cartId: 'cart-c2', subtotal: 20000 },
    409,
    'COUPON_UNAVAILABLE',
  );
  await expectApply(
    h,
    'Apply unknown coupon',
    { code: 'NOPE', cartId: 'cart-c3', subtotal: 20000 },
    404,
    'COUPON_NOT_FOUND',
  );
  await expectApply(
    h,
    'Apply coupon with invalid body',
    { code: '', cartId: 5, subtotal: -1 },
    400,
    'VALIDATION_ERROR',
  );
  await expectApply(
    h,
    'Apply coupon below minimum subtotal',
    { code: 'BIGSPEND', cartId: 'cart-c4', subtotal: 5000 },
    422,
    'MIN_SUBTOTAL_NOT_MET',
  );
}

export async function runConcurrencyScenario(h: Harness): Promise<void> {
  const results = await Promise.all(
    Array.from({ length: 25 }, (_, i) =>
      h.http('POST', APPLY, { code: 'FLASH5', cartId: `flash-cart-${i}`, subtotal: 10000 }),
    ),
  );
  const ok = results.filter((r) => r.status === 200).length;
  const exhausted = results.filter(
    (r) => r.status === 409 && dig(r.body, 'error', 'code') === 'COUPON_EXHAUSTED',
  ).length;
  const coupon = await Coupon.findOne({ code: 'FLASH5' }).lean();
  const reservations = await CouponReservation.countDocuments({ couponCode: 'FLASH5' });
  h.record({
    name: 'Concurrency: 25 parallel applies of FLASH5 (maxUses 5)',
    method: 'POST',
    path: `${APPLY} x25`,
    requestBody: { code: 'FLASH5', cartId: 'flash-cart-<0..24>', subtotal: 10000 },
    status: undefined,
    responseBody: {
      status200: ok,
      status409CouponExhausted: exhausted,
      finalRemainingUses: coupon?.remainingUses,
      reservationsInDb: reservations,
    },
    expected: '5x200, 20x409 COUPON_EXHAUSTED, remainingUses 0, 5 reservations',
    pass: ok === 5 && exhausted === 20 && coupon?.remainingUses === 0 && reservations === 5,
  });
}
