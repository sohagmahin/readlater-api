import { z } from "zod";

const email = z.string().email().transform((s) => s.toLowerCase().trim());

export const registerSchema = z.object({
  email,
  password: z.string().min(8).max(72),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});