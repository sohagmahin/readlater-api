import express from "express";
import { authRouter } from "./modules/auth/auth.router.js";
import { authenticate } from "./middleware/authenticate.js";
import { errorHandler } from "./middleware/errorHandler.js";

export const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRouter);

// সাময়িক: authenticate কাজ করছে কিনা দেখার জন্য, পরে মুছে দেব
app.get("/me", authenticate, (req, res) => {
  res.json({ userId: req.user!.id });
});

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use(errorHandler); // সবার শেষে