import { sql } from "drizzle-orm";
import request from "supertest";
import { app } from "../src/app.js";
import { db } from "../src/db/client.js";
import { apiRedis } from "../src/lib/redis.js";

export async function resetDb() {
  await db.execute(sql`TRUNCATE users, bookmarks, tags, bookmark_tags CASCADE`);
  await apiRedis.flushdb(); // শুধু টেস্টের ১ নম্বর Redis ডেটাবেস
}

let counter = 0;

export async function createUser() {
  const email = `user${++counter}-${Date.now()}@test.com`;
  const password = "password123";
  await request(app).post("/auth/register").send({ email, password });
  const res = await request(app).post("/auth/login").send({ email, password });
  return {
    email,
    token: res.body.accessToken as string,
    auth: { Authorization: `Bearer ${res.body.accessToken}` },
  };
}