import { Router } from 'express';
import { calculate } from '../controllers/pricing.controller';
import { getById } from '../controllers/audit.controller';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../middlewares/asyncHandler';
import { calculateRequestSchema } from '../dtos/pricing.dto';
import { auditParamsSchema } from '../dtos/audit.dto';

export const pricingRouter = Router();

pricingRouter.post('/calculate', validate('body', calculateRequestSchema), asyncHandler(calculate));
pricingRouter.get('/audit/:auditId', validate('params', auditParamsSchema), asyncHandler(getById));
