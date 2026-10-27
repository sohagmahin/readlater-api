import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { parse, validate } from "../../middleware/validate.js";
import { addTagsSchema, bookmarkTagParamSchema } from "../tags/tags.schemas.js";
import * as tagsService from "../tags/tags.service.js";
import { metadataQueue } from "../../queues/metadata.queue.js";
import {
  createBookmarkSchema,
  idParamSchema,
  listQuerySchema,
  updateBookmarkSchema,
} from "./bookmarks.schemas.js";
import * as service from "./bookmarks.service.js";

export const bookmarksRouter = Router();

bookmarksRouter.use(authenticate);

bookmarksRouter.post("/", validate(createBookmarkSchema), async (req, res) => {
  const { bookmark, created } = await service.create(
    req.user!.id,
    req.body.url,
  );
  if (created) {
    try {
      await metadataQueue.add(
        "fetch",
        { bookmarkId: bookmark.id },
        { jobId: `metadata-${bookmark.id}` },
      );
    } catch (err) {
      console.error("failed to enqueue metadata job", err);
    }
  }
  res.status(created ? 201 : 200).json(bookmark);
});

bookmarksRouter.post("/:id/tags", validate(addTagsSchema), async (req, res) => {
  const { id } = parse(idParamSchema, req.params);
  res.json(await tagsService.addTags(req.user!.id, id, req.body.tags));
});

bookmarksRouter.get("/", async (req, res) => {
  const query = parse(listQuerySchema, req.query);
  res.json(await service.list(req.user!.id, query));
});

bookmarksRouter.get("/:id", async (req, res) => {
  const { id } = parse(idParamSchema, req.params);
  res.json(await service.getOne(req.user!.id, id));
});

bookmarksRouter.patch(
  "/:id",
  validate(updateBookmarkSchema),
  async (req, res) => {
    const { id } = parse(idParamSchema, req.params);
    res.json(await service.update(req.user!.id, id, req.body));
  },
);

bookmarksRouter.delete("/:id", async (req, res) => {
  const { id } = parse(idParamSchema, req.params);
  await service.remove(req.user!.id, id);
  res.status(204).send();
});

bookmarksRouter.delete("/:id/tags/:tagId", async (req, res) => {
  const { id, tagId } = parse(bookmarkTagParamSchema, req.params);
  await tagsService.removeTag(req.user!.id, id, tagId);
  res.status(204).send();
});
