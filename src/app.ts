import express from "express";
import { authRouter } from "./modules/auth/auth.router.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { bookmarksRouter } from "./modules/bookmarks/bookmarks.router.js";
import { tagsRouter } from "./modules/tags/tags.router.js";
import { rateLimit } from "./middleware/rateLimit.js";

export const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(
  "/auth",
  rateLimit({
    name: "auth",
    limit: 10,
    windowSec: 60,
    key: (req) => req.ip ?? "unknown",
  }),
  authRouter,
);
app.use("/bookmarks", bookmarksRouter);
app.use("/tags", tagsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use(errorHandler); // সবার শেষে
