import { Router } from "express";
import { syncOfflineQueue } from "../controllers/partner.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/queue", verifyJWT, syncOfflineQueue);

export default router;
