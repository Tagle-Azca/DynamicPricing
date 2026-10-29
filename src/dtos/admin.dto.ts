import { z } from 'zod';

export const listAuditsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  userId: z.string().min(1).max(128).optional(),
  cartId: z.string().min(1).max(128).optional(),
});

export type ListAuditsQuery = z.infer<typeof listAuditsQuerySchema>;
