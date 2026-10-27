DROP INDEX "bookmarks_user_created_idx";--> statement-breakpoint
ALTER TABLE "bookmarks" ALTER COLUMN "created_at" SET DATA TYPE timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "bookmarks" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
CREATE INDEX "bookmarks_user_created_id_idx" ON "bookmarks" USING btree ("user_id","created_at","id");