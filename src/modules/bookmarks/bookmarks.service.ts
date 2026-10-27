import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { bookmarks } from "../../db/schema.js";
import { AppError } from "../../lib/errors.js";

type Status = (typeof bookmarks.$inferSelect)["status"];

export async function create(userId: string, url: string) {
  const [created] = await db
    .insert(bookmarks)
    .values({ userId, url })
    .onConflictDoNothing({ target: [bookmarks.userId, bookmarks.url] })
    .returning();

  if (created) return { bookmark: created, created: true };

  const [existing] = await db
    .select()
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), eq(bookmarks.url, url)))
    .limit(1);
  return { bookmark: existing, created: false };
}

export async function list(userId: string, opts: { status?: Status; limit: number }) {
  return db
    .select()
    .from(bookmarks)
    .where(
      and(
        eq(bookmarks.userId, userId),
        opts.status ? eq(bookmarks.status, opts.status) : undefined,
      ),
    )
    .orderBy(desc(bookmarks.createdAt))
    .limit(opts.limit);
}

export async function getOne(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(bookmarks)
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
    .limit(1);
  if (!row) throw new AppError(404, "Bookmark not found");
  return row;
}

export async function update(
  userId: string,
  id: string,
  changes: { status?: Status; title?: string },
) {
  const [row] = await db
    .update(bookmarks)
    .set({ ...changes, updatedAt: new Date() })
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
    .returning();
  if (!row) throw new AppError(404, "Bookmark not found");
  return row;
}

export async function remove(userId: string, id: string) {
  const [row] = await db
    .delete(bookmarks)
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
    .returning({ id: bookmarks.id });
  if (!row) throw new AppError(404, "Bookmark not found");
}