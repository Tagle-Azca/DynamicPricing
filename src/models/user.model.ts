import { Schema, model } from 'mongoose';
import { ROLES, TIERS } from '../dtos/auth.dto';
import type { Role, Tier } from '../dtos/auth.dto';

export interface UserDoc {
  email: string;
  passwordHash: string;
  role: Role;
  tier: Tier;
  createdAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, default: 'customer' },
    tier: { type: String, enum: TIERS, required: true, default: 'standard' },
    createdAt: { type: Date, required: true, default: () => new Date() },
  },
  { collection: 'users', versionKey: false, strict: 'throw' },
);

export const User = model<UserDoc>('User', userSchema);
