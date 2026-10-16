import { Schema, model } from 'mongoose';

export interface CampaignConditions {
  minSubtotal?: number;
  skus?: string[];
  categories?: string[];
  customerTiers?: string[];
}

export interface CampaignDoc {
  code: string;
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
  priority: number;
  stackable: boolean;
  startsAt: Date;
  endsAt: Date;
  isActive: boolean;
  conditions: CampaignConditions;
}

const conditionsSchema = new Schema<CampaignConditions>(
  {
    minSubtotal: { type: Number, min: 0 },
    skus: { type: [String], default: undefined },
    categories: { type: [String], default: undefined },
    customerTiers: { type: [String], default: undefined },
  },
  { _id: false },
);

const campaignSchema = new Schema<CampaignDoc>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['percentage', 'fixed'], required: true },
    value: { type: Number, required: true, min: 0 },
    priority: { type: Number, required: true, default: 0 },
    stackable: { type: Boolean, required: true, default: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    isActive: { type: Boolean, required: true, default: true },
    conditions: { type: conditionsSchema, default: () => ({}) },
  },
  { timestamps: true, versionKey: false },
);

campaignSchema.index({ isActive: 1, startsAt: 1, endsAt: 1 });

export const Campaign = model<CampaignDoc>('Campaign', campaignSchema);
