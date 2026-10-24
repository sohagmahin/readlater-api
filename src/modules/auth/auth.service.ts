import bcrypt from "bcrypt";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { users } from "../../db/schema.js";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";

function signAccess(userId: string) {
  return jwt.sign({}, env.JWT_ACCESS_SECRET, {
    subject: userId,
    expiresIn: env.ACCESS_TTL_SECONDS,
  });
}

function signRefresh(userId: string) {
  return jwt.sign({}, env.JWT_REFRESH_SECRET, {
    subject: userId,
    expiresIn: env.REFRESH_TTL_SECONDS,
  });
}

export async function register(email: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const [user] = await db
      .insert(users)
      .values({ email, passwordHash })
      .returning({ id: users.id, email: users.email, createdAt: users.createdAt });
    return user;
  } catch (err: any) {
    const code = err?.code ?? err?.cause?.code;
    if (code === "23505") throw new AppError(409, "Email already registered");
    throw err;
  }
}

export async function login(email: string, password: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!user || !ok) throw new AppError(401, "Invalid email or password");

  return {
    accessToken: signAccess(user.id),
    refreshToken: signRefresh(user.id),
  };
}

export function refresh(refreshToken: string) {
  try {
    const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as JwtPayload;
    return { accessToken: signAccess(payload.sub as string) };
  } catch {
    throw new AppError(401, "Invalid or expired refresh token");
  }
}