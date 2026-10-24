import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { loginSchema, refreshSchema, registerSchema } from "./auth.schemas.js";
import * as authService from "./auth.service.js";

export const authRouter = Router();

authRouter.post("/register", validate(registerSchema), async (req, res) => {
  const user = await authService.register(req.body.email, req.body.password);
  res.status(201).json(user);
});

authRouter.post("/login", validate(loginSchema), async (req, res) => {
  const tokens = await authService.login(req.body.email, req.body.password);
  res.json(tokens);
});

authRouter.post("/refresh", validate(refreshSchema), (req, res) => {
  res.json(authService.refresh(req.body.refreshToken));
});