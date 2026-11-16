import { z } from 'zod';

export const ROLES = ['customer', 'admin'] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

const email = z.string().trim().toLowerCase().max(254).email();

const registerPassword = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .refine((v) => Buffer.byteLength(v, 'utf8') <= 72, {
    message: 'Password must be at most 72 bytes',
  });

export const registerSchema = z.object({ email, password: registerPassword }).strict();

export const loginSchema = z.object({ email, password: z.string().min(1).max(256) }).strict();

export type RegisterRequest = z.infer<typeof registerSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;

export const tokenPayloadSchema = z.object({
  sub: z.string().min(1),
  role: roleSchema,
});

export interface Principal {
  sub: string;
  role: Role;
}

export interface PublicUser {
  id: string;
  email: string;
  role: Role;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: PublicUser;
}
