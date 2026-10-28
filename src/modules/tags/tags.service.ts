import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "../../db/client.js";
import { bookmarks, bookmarkTags, tags } from "../../db/schema.js";
import { AppError } from "../../lib/errors.js";
import { bumpListVersion } from "../../lib/cache.js";

export async function listTags(userId: string) {
  return db
    .select({
      id: tags.id,
      name: tags.name,
      bookmarkCount: count(bookmarkTags.bookmarkId),
    })
    .from(tags)
    .leftJoin(bookmarkTags, eq(bookmarkTags.tagId, tags.id))
    .where(eq(tags.userId, userId))
    .groupBy(tags.id)
    .orderBy(tags.name);
}

export async function addTags(
  userId: string,
  bookmarkId: string,
  names: string[],
) {
  const unique = [...new Set(names)];

  const result = await db.transaction(async (tx) => {
    const [bm] = await tx
      .select({ id: bookmarks.id })
      .from(bookmarks)
      .where(and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId)))
      .limit(1);
    if (!bm) throw new AppError(404, "Bookmark not found");

    await tx
      .insert(tags)
      .values(unique.map((name) => ({ userId, name })))
      .onConflictDoNothing({ target: [tags.userId, tags.name] });

    const rows = await tx
      .select({ id: tags.id, name: tags.name })
      .from(tags)
      .where(and(eq(tags.userId, userId), inArray(tags.name, unique)));

    await tx
      .insert(bookmarkTags)
      .values(rows.map((t) => ({ bookmarkId, tagId: t.id })))
      .onConflictDoNothing();

    return rows;
  });

  await bumpListVersion(userId);
  return result;
}

export async function removeTag(
  userId: string,
  bookmarkId: string,
  tagId: string,
) {
  const [bm] = await db
    .select({ id: bookmarks.id })
    .from(bookmarks)
    .where(and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId)))
    .limit(1);
  if (!bm) throw new AppError(404, "Bookmark not found");

  const deleted = await db
    .delete(bookmarkTags)
    .where(
      and(
        eq(bookmarkTags.bookmarkId, bookmarkId),
        eq(bookmarkTags.tagId, tagId),
      ),
    )
    .returning();
  if (deleted.length === 0)
    throw new AppError(404, "Tag not attached to this bookmark");

  await bumpListVersion(userId);
}
