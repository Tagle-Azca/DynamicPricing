import { AppError } from '../errors/AppError';
import type { Principal } from '../dtos/auth.dto';
import type { CalculateRequest } from '../dtos/pricing.dto';
import { getUserTier } from './user.tier';

/**
 * Makes the audit owner server-authoritative. Customers can only price as themselves;
 * admins may price on behalf of another user and default to their own subject.
 */
export async function resolvePricingOwner(
  request: CalculateRequest,
  principal: Principal,
): Promise<CalculateRequest> {
  const requested = request.context.userId;
  if (principal.role !== 'admin' && requested !== undefined && requested !== principal.sub) {
    throw new AppError(
      403,
      'USER_MISMATCH',
      'context.userId does not match the authenticated user',
    );
  }
  const userId = principal.role === 'admin' ? (requested ?? principal.sub) : principal.sub;
  // The tier is the audit owner's stored tier (never the admin's when pricing for a customer);
  // whatever the client sent was already stripped.
  const customerTier = await getUserTier(userId);
  return { ...request, context: { ...request.context, userId, customerTier } };
}
