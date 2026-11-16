import { Schema, model } from 'mongoose';
import { ROLES } from '../dtos/auth.dto';
import type { Role } from '../dtos/auth.dto';

export interface UserDoc {
  email: string;
  passwordHash: string;
  role: Role;
  createdAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, default: 'customer' },
    createdAt: { type: Date, required: true, default: () => new Date() },
  },
  { collection: 'users', versionKey: false, strict: 'throw' },
);

export const User = model<UserDoc>('User', userSchema);
