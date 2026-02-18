import { Router } from "express";
import {
  createContribution,
  listTransactions,
  getTransactionDetail,
  updateTransaction,
  undoTransaction,
} from "../controllers/partner.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", verifyJWT, listTransactions);
router.get("/:transaction_id", verifyJWT, getTransactionDetail);
router.patch("/:transaction_id", verifyJWT, updateTransaction);
router.post("/:transaction_id/undo", verifyJWT, undoTransaction);
router.post("/", verifyJWT, createContribution);

export default router;
