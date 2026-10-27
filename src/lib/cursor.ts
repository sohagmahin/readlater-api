import { z } from "zod";
import { AppError } from "./errors.js";

const payload = z.object({
  t: z.string().datetime(),
  i: z.string().uuid(),
});

export function encodeCursor(createdAt: Date, id: string) {
  return Buffer.from(
    JSON.stringify({ t: createdAt.toISOString(), i: id }),
  ).toString("base64url");
}

export function decodeCursor(cursor: string) {
  try {
    const p = payload.parse(JSON.parse(Buffer.from(cursor, "base64url").toString()));
    return { createdAt: new Date(p.t), id: p.i };
  } catch {
    throw new AppError(400, "Invalid cursor");
  }
}