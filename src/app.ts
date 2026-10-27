import express from "express";
import { authRouter } from "./modules/auth/auth.router.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { bookmarksRouter } from "./modules/bookmarks/bookmarks.router.js";
import { tagsRouter } from "./modules/tags/tags.router.js";


export const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRouter);
app.use("/bookmarks", bookmarksRouter);
app.use("/tags", tagsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use(errorHandler); // সবার শেষে