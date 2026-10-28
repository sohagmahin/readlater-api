import { Queue } from "bullmq";
import { apiRedis } from "../lib/redis.js";

export type MetadataJob = { bookmarkId: string };

export const metadataQueue = new Queue<MetadataJob>("metadata", {
  connection: apiRedis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
    removeOnFail: 100,
  },
});

metadataQueue.on("error", (err) => console.error("metadata queue error:", err.message));