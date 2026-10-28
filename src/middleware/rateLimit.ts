import type { Request, RequestHandler } from "express";
import { AppError } from "../lib/errors.js";
import { apiRedis } from "../lib/redis.js";

type Options = {
  name: string;
  limit: number;
  windowSec: number;
  key: (req: Request) => string;
};

export const rateLimit =
  ({ name, limit, windowSec, key }: Options): RequestHandler =>
  async (req, res, next) => {
    const redisKey = `rl:${name}:${key(req)}`;

    let count: number;
    let ttl: number;
    try {
      const replies = await apiRedis
        .multi()
        .incr(redisKey)
        .expire(redisKey, windowSec, "NX")
        .ttl(redisKey)
        .exec();
      if (!replies) throw new Error("empty reply");
      const [[incrErr, c], , [ttlErr, t]] = replies;
      if (incrErr || ttlErr) throw incrErr ?? ttlErr;
      count = Number(c);
      ttl = Number(t) > 0 ? Number(t) : windowSec;
    } catch (err) {
      console.error("rate limiter unavailable, letting request through", err);
      return next();
    }

    res.setHeader("RateLimit-Limit", limit);
    res.setHeader("RateLimit-Remaining", Math.max(0, limit - count));
    res.setHeader("RateLimit-Reset", ttl);

    if (count > limit) {
      res.setHeader("Retry-After", ttl);
      throw new AppError(429, "Too many requests, slow down");
    }
    next();
  };