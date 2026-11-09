import { z } from 'zod';

export const LoginRequest = z.object({
  email: z.string().min(1).max(254),
  password: z.string().min(1).max(256),
});

export const ForgotPasswordRequest = z.object({ email: z.string().min(1).max(254) });

export const SetPasswordWithTokenRequest = z.object({
  token: z.string().min(10).max(200),
  password: z.string().min(1).max(256),
});

export const ChangePasswordRequest = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(1).max(256),
});

export const CreateApiKeyRequest = z.object({ name: z.string().min(1).max(100) });

export const SessionResponse = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string(),
    name: z.string(),
    role: z.enum(['admin', 'editor', 'author']),
  }),
});
