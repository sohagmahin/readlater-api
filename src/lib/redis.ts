import { Redis } from "ioredis";
import { env } from "../config/env.js";

export const apiRedis = new Redis(env.REDIS_URL, {
  enableOfflineQueue: false, // কানেকশন না থাকলে কমান্ড জমায় না, সাথে সাথে error দেয়
  commandTimeout: 500,       // Redis আটকে গেলেও ৫০০ms-এর বেশি অপেক্ষা নয়
});

apiRedis.on("error", (err) => console.error("redis (api) error:", err.message));