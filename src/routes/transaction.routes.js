import { Router } from "express";
import { createContribution } from "../controllers/partner.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/", verifyJWT, createContribution);

export default router;
