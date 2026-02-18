import { Router } from "express";
import {
  registerUser,
  loginUser,
  refreshToken,
  logoutUser,
} from "../controllers/auth.controller.js";
import {
  registerLimiter,
  loginIpLimiter,
} from "../middlewares/rateLimiter.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/register", registerLimiter, registerUser);
router.post("/login", loginIpLimiter, loginUser);
router.post("/refresh", refreshToken);
router.post("/logout", verifyJWT, logoutUser);

export default router;
