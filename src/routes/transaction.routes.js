import { Router } from "express";
import {
  createContribution,
  listTransactions,
  getTransactionDetail,
} from "../controllers/partner.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", verifyJWT, listTransactions);
router.get("/:transaction_id", verifyJWT, getTransactionDetail);
router.post("/", verifyJWT, createContribution);

export default router;
