import {
  pgTable, uuid, text, timestamp, pgEnum, primaryKey, uniqueIndex, index,
} from "drizzle-orm/pg-core";

export const bookmarkStatus = pgEnum("bookmark_status", ["unread", "read", "archived"]);
export const fetchStatus = pgEnum("fetch_status", ["pending", "ready", "failed"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bookmarks = pgTable("bookmarks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  title: text("title"),
  description: text("description"),
  faviconUrl: text("favicon_url"),
  status: bookmarkStatus("status").notNull().default("unread"),
  fetchStatus: fetchStatus("fetch_status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("bookmarks_user_url_idx").on(t.userId, t.url),
  index("bookmarks_user_created_idx").on(t.userId, t.createdAt),
]);

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
}, (t) => [
  uniqueIndex("tags_user_name_idx").on(t.userId, t.name),
]);

export const bookmarkTags = pgTable("bookmark_tags", {
  bookmarkId: uuid("bookmark_id").notNull().references(() => bookmarks.id, { onDelete: "cascade" }),
  tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (t) => [
  primaryKey({ columns: [t.bookmarkId, t.tagId] }),
]);