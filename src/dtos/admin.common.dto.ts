import { z } from 'zod';

export const cents = z.number().int().nonnegative();

export const upperCode = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .transform((v) => v.toUpperCase());

export const regionCode = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2}$/)
  .transform((v) => v.toUpperCase());

export const strictDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}/, 'Expected an ISO date string')
  .transform((value, ctx) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: 'custom', message: 'Invalid date' });
      return z.NEVER;
    }
    return date;
  });
