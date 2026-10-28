import express from "express";
import { apiReference } from "@scalar/express-api-reference";
import { openapiDocument } from "./docs/openapi.js";
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

app.get("/docs/openapi.json", (_req, res) => {
  res.json(openapiDocument);
});
app.get(
  "/docs",
  apiReference({
    url: "/docs/openapi.json",
    pageTitle: "ReadLater API Docs",
    // UI CDN থেকে আসে; ভার্সন পিন করা, যাতে latest বদলালে হঠাৎ কিছু না ভাঙে
    bundle: "https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.74.0/esm.js",
    persistAuth: true, // রিলোড করলেও টোকেন থাকে
    authentication: { preferredSecurityScheme: "bearerAuth" },
  }),
);

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
