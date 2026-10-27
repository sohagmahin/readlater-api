import { z } from "zod";
import { tagNameSchema } from "../tags/tags.schemas.js";

const statusEnum = z.enum(["unread", "read", "archived"]);

const httpUrl = z
  .string()
  .max(2048)
  .url()
  .refine((u) => {
    try {
      return ["http:", "https:"].includes(new URL(u).protocol);
    } catch {
      return false;
    }
  }, "Only http/https URLs are allowed")
  .transform((u) => new URL(u).toString());

export const createBookmarkSchema = z.object({ url: httpUrl });

export const updateBookmarkSchema = z
  .object({
    status: statusEnum.optional(),
    title: z.string().trim().min(1).max(500).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, "At least one field is required");

export const idParamSchema = z.object({ id: z.string().uuid() });

export const listQuerySchema = z.object({
  status: statusEnum.optional(),
  tag: tagNameSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});