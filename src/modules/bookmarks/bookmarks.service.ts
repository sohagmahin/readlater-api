import { and, desc, eq, inArray,lt,or } from "drizzle-orm";
import { db } from "../../db/client.js";
import { bookmarks, bookmarkTags, tags } from "../../db/schema.js";
import { AppError } from "../../lib/errors.js";
import { decodeCursor, encodeCursor } from "../../lib/cursor.js";

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

export async function list(
  userId: string,
  opts: { status?: Status; tag?: string; cursor?: string; limit: number },
) {
  const cursor = opts.cursor ? decodeCursor(opts.cursor) : undefined;

  const rows = await db
    .select()
    .from(bookmarks)
    .where(
      and(
        eq(bookmarks.userId, userId),
        opts.status ? eq(bookmarks.status, opts.status) : undefined,
        opts.tag
          ? inArray(
              bookmarks.id,
              db
                .select({ id: bookmarkTags.bookmarkId })
                .from(bookmarkTags)
                .innerJoin(tags, eq(tags.id, bookmarkTags.tagId))
                .where(and(eq(tags.userId, userId), eq(tags.name, opts.tag))),
            )
          : undefined,
        cursor
          ? or(
              lt(bookmarks.createdAt, cursor.createdAt),
              and(
                eq(bookmarks.createdAt, cursor.createdAt),
                lt(bookmarks.id, cursor.id),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(desc(bookmarks.createdAt), desc(bookmarks.id))
    .limit(opts.limit + 1);

  const hasMore = rows.length > opts.limit;
  const page = hasMore ? rows.slice(0, opts.limit) : rows;
  const last = page[page.length - 1];

  return {
    items: await withTags(page),
    nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
  };
}

export async function getOne(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(bookmarks)
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
    .limit(1);
  if (!row) throw new AppError(404, "Bookmark not found");
  return (await withTags([row]))[0];
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
  return (await withTags([row]))[0];
}

export async function remove(userId: string, id: string) {
  const [row] = await db
    .delete(bookmarks)
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
    .returning({ id: bookmarks.id });
  if (!row) throw new AppError(404, "Bookmark not found");
}

async function withTags<T extends { id: string }>(rows: T[]) {
  if (rows.length === 0) return [];

  const found = await db
    .select({
      bookmarkId: bookmarkTags.bookmarkId,
      id: tags.id,
      name: tags.name,
    })
    .from(bookmarkTags)
    .innerJoin(tags, eq(tags.id, bookmarkTags.tagId))
    .where(
      inArray(
        bookmarkTags.bookmarkId,
        rows.map((r) => r.id),
      ),
    );

  const byBookmark = new Map<string, { id: string; name: string }[]>();
  for (const f of found) {
    const arr = byBookmark.get(f.bookmarkId) ?? [];
    arr.push({ id: f.id, name: f.name });
    byBookmark.set(f.bookmarkId, arr);
  }

  return rows.map((r) => ({ ...r, tags: byBookmark.get(r.id) ?? [] }));
}
