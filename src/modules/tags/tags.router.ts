import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import * as tagsService from "./tags.service.js";

export const tagsRouter = Router();

tagsRouter.use(authenticate);

tagsRouter.get("/", async (req, res) => {
  res.json(await tagsService.listTags(req.user!.id));
});