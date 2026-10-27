import { Queue } from "bullmq";
import { redis } from "./connection.js";

export type MetadataJob = { bookmarkId: string };

export const metadataQueue = new Queue<MetadataJob>("metadata", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
    removeOnFail: 100,
  },
});