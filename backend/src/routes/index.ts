import { Router } from "express";
import { authRouter } from "./auth.routes.js";

export const router = Router();

router.use("/auth", authRouter);
