import { apiRedis } from "./redis.js";

export async function getListVersion(userId: string): Promise<string | null> {
  try {
    return (await apiRedis.get(`bm:ver:${userId}`)) ?? "0";
  } catch (err) {
    console.error("cache version read failed", err);
    return null; // null মানে "cache ব্যবহার করো না"
  }
}

export async function bumpListVersion(userId: string) {
  try {
    await apiRedis.incr(`bm:ver:${userId}`);
  } catch (err) {
    console.error("cache invalidation failed", err);
  }
}

export async function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  try {
    const hit = await apiRedis.get(key);
    if (hit) return JSON.parse(hit) as T;
  } catch (err) {
    console.error("cache read failed", err);
  }

  const value = await load();

  try {
    await apiRedis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    console.error("cache write failed", err);
  }
  return value;
}