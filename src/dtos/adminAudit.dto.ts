import { z } from 'zod';
import { strictDate } from './admin.common.dto';

export const listAuditsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  userId: z.string().min(1).max(128).optional(),
  cartId: z.string().min(1).max(128).optional(),
});

export const exportAuditsQuerySchema = z
  .object({
    format: z.enum(['json', 'csv']).default('json'),
    from: strictDate.optional(),
    to: strictDate.optional(),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    message: 'from must not be after to',
    path: ['from'],
  });

export const adminAuditParamsSchema = z.object({ auditId: z.string().uuid() });

export type ListAuditsQuery = z.infer<typeof listAuditsQuerySchema>;
export type ExportAuditsQuery = z.infer<typeof exportAuditsQuerySchema>;
