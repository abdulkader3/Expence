import { Router } from "express";
import { createAllocation } from "../controllers/allocation.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/", verifyJWT, createAllocation);

export default router;
