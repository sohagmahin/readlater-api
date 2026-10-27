import type { RequestHandler } from "express";
import { z, type ZodType } from "zod";
import { AppError } from "../lib/errors.js";

export function parse<T extends ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError(400, "Validation failed", result.error.issues);
  }
  return result.data;
}

export const validate =
  (schema: ZodType): RequestHandler =>
  (req, _res, next) => {
    req.body = parse(schema, req.body);
    next();
  };