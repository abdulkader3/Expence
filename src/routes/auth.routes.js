import { Router } from "express";
import { registerUser } from "../controllers/auth.controller.js";
import { registerLimiter } from "../middlewares/rateLimiter.middleware.js";

const router = Router();

router.post("/register", registerLimiter, registerUser);

export default router;
