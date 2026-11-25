import { Harness, dig } from './harness';
import { auditFor } from './admin.helpers';
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
  const token = h.token ?? '';
  const audit = (cartId: string): Promise<string> => auditFor(h, token, cartId);
  const ok = { code: 'WELCOME10', auditId: await audit('cart-c1') };
  await expectApply(h, 'Apply coupon to an audit (transaction, reserved)', ok, 201);
  await expectApply(h, 'Apply same coupon to same cart again', ok, 409, 'COUPON_ALREADY_APPLIED');
  await expectApply(
    h,
    'Apply WELCOME10 to a second cart (perUserLimit 1)',
    { code: 'WELCOME10', auditId: await audit('cart-c1b') },
    409,
    'COUPON_LIMIT_REACHED',
  );
  await expectApply(
    h,
    'Apply expired coupon',
    { code: 'EXPIRED20', auditId: await audit('cart-c2') },
    409,
    'COUPON_UNAVAILABLE',
  );
  await expectApply(
    h,
    'Apply unknown coupon',
    { code: 'NOPE', auditId: await audit('cart-c3') },
    404,
    'COUPON_NOT_FOUND',
  );
  await expectApply(
    h,
    'Apply coupon with invalid body',
    { code: '', auditId: 5 },
    400,
    'VALIDATION_ERROR',
  );
  await expectApply(
    h,
    'Apply coupon with a client-supplied subtotal',
    { ...ok, subtotal: 1 },
    400,
    'VALIDATION_ERROR',
  );
  await expectApply(
    h,
    'Apply coupon to an audit that does not exist',
    { code: 'WELCOME10', auditId: '00000000-0000-4000-8000-000000000000' },
    404,
    'AUDIT_NOT_FOUND',
  );
  await expectApply(
    h,
    'Apply coupon below minimum subtotal',
    { code: 'BIGSPEND', auditId: await audit('cart-c4') },
    422,
    'MIN_SUBTOTAL_NOT_MET',
  );
}

export async function runConcurrencyScenario(h: Harness): Promise<void> {
  const token = h.token ?? '';
  const audits = await Promise.all(
    Array.from({ length: 25 }, (_, i) => auditFor(h, token, `flash-cart-${i}`)),
  );
  const results = await Promise.all(
    audits.map((auditId) => h.http('POST', APPLY, { code: 'FLASH5', auditId })),
  );
  const ok = results.filter((r) => r.status === 201).length;
  const exhausted = results.filter(
    (r) => r.status === 409 && dig(r.body, 'error', 'code') === 'COUPON_EXHAUSTED',
  ).length;
  const coupon = await Coupon.findOne({ code: 'FLASH5' }).lean();
  const reservations = await CouponReservation.countDocuments({ couponCode: 'FLASH5' });
  h.record({
    name: 'Concurrency: 25 parallel applies of FLASH5 (maxUses 5)',
    method: 'POST',
    path: `${APPLY} x25`,
    requestBody: { code: 'FLASH5', auditId: '<audit of flash-cart-0..24>' },
    status: undefined,
    responseBody: {
      status201: ok,
      status409CouponExhausted: exhausted,
      finalRemainingUses: coupon?.remainingUses,
      reservationsInDb: reservations,
    },
    expected: '5x201, 20x409 COUPON_EXHAUSTED, remainingUses 0, 5 reservations',
    pass: ok === 5 && exhausted === 20 && coupon?.remainingUses === 0 && reservations === 5,
  });
}
