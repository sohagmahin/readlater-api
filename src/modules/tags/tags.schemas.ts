import { z } from "zod";

export const tagNameSchema = z.string().trim().toLowerCase().min(1).max(50);

export const addTagsSchema = z.object({
  tags: z.array(tagNameSchema).min(1).max(10),
});

export const bookmarkTagParamSchema = z.object({
  id: z.string().uuid(),
  tagId: z.string().uuid(),
});