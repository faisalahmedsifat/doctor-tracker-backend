import { z } from 'zod';

export const loginBodySchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
}).strict();

export const adminResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: z.literal('admin'),
});

export const authSuccessSchema = z.object({
  success: z.literal(true),
  data: z.object({ admin: adminResponseSchema }),
});

export const authErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({ code: z.string(), message: z.string() }),
});

export type LoginBody = z.infer<typeof loginBodySchema>;
