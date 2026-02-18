import { Router } from "express";
import {
  createContribution,
  listTransactions,
} from "../controllers/partner.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", verifyJWT, listTransactions);
router.post("/", verifyJWT, createContribution);

export default router;
