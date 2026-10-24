import type { ErrorRequestHandler } from "express";
import { AppError } from "../lib/errors.js";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    return res
      .status(err.status)
      .json({ error: err.message, details: err.details });
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
};
