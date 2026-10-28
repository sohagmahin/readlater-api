import { Worker, UnrecoverableError, type Job } from "bullmq";
import { eq, sql } from "drizzle-orm";
import { db, sql as pg } from "./db/client.js";
import { bookmarks } from "./db/schema.js";
import { redis } from "./queues/connection.js";
import type { MetadataJob } from "./queues/metadata.queue.js";
import { safeFetchHtml } from "./lib/safeFetch.js";
import { extractMetadata } from "./modules/bookmarks/metadata.js";
import { bumpListVersion } from "./lib/cache.js";
import { apiRedis } from "./lib/redis.js";

async function processMetadata(job: Job<MetadataJob>) {
  const [bm] = await db
    .select({ id: bookmarks.id, url: bookmarks.url, userId: bookmarks.userId })
    .from(bookmarks)
    .where(eq(bookmarks.id, job.data.bookmarkId))
    .limit(1);

  if (!bm) return; // job চলার আগেই ইউজার মুছে দিয়েছে

  const { html, finalUrl } = await safeFetchHtml(bm.url);
  const meta = html
    ? extractMetadata(html, finalUrl)
    : { title: null, description: null, faviconUrl: null };

  await db
    .update(bookmarks)
    .set({
      title: sql`coalesce(${bookmarks.title}, ${meta.title})`,
      description: meta.description,
      faviconUrl: meta.faviconUrl,
      fetchStatus: "ready",
      updatedAt: new Date(),
    })
    .where(eq(bookmarks.id, bm.id));
  await bumpListVersion(bm.userId);
}

const worker = new Worker<MetadataJob>("metadata", processMetadata, {
  connection: redis,
  concurrency: 5,
});

worker.on("completed", (job) => {
  console.log(`job ${job.id} done`);
});

worker.on("failed", async (job, err) => {
  if (!job) return;
  const attempts = job.opts.attempts ?? 1;
  const isFinal =
    err instanceof UnrecoverableError || job.attemptsMade >= attempts;
  console.warn(
    `job ${job.id} failed (attempt ${job.attemptsMade}/${attempts}): ${err.message}`,
  );

  if (!isFinal) return;
  try {
    const [row] = await db
      .update(bookmarks)
      .set({ fetchStatus: "failed", updatedAt: new Date() })
      .where(eq(bookmarks.id, job.data.bookmarkId))
      .returning({ userId: bookmarks.userId });
    if (row) await bumpListVersion(row.userId);
  } catch (e) {
    console.error("could not mark bookmark as failed", e);
  }
});

worker.on("error", (err) => console.error("worker error", err));

async function shutdown() {
  console.log("shutting down worker...");
  await worker.close();
  await apiRedis.quit();
  await pg.end();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log("Worker started, waiting for jobs...");
