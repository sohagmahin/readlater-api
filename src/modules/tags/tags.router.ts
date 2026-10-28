import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import * as tagsService from "./tags.service.js";
import { rateLimit } from "../../middleware/rateLimit.js";

export const tagsRouter = Router();

tagsRouter.use(authenticate);
tagsRouter.use(
  rateLimit({
    name: "api",
    limit: 100,
    windowSec: 60,
    key: (req) => req.user!.id,
  }),
);

tagsRouter.get("/", async (req, res) => {
  res.json(await tagsService.listTags(req.user!.id));
});
