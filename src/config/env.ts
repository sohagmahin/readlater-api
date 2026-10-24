import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TTL_SECONDS: z.coerce.number().default(900), // ১৫ মিনিট
  REFRESH_TTL_SECONDS: z.coerce.number().default(604800), // ৭ দিন
});

export const env = schema.parse(process.env);
