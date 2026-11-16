import { z } from 'zod';
import { regionCode, upperCode } from './admin.common.dto';

export const campaignRegionParamsSchema = z.object({ code: upperCode, region: regionCode });

export type CampaignRegionParams = z.infer<typeof campaignRegionParamsSchema>;
