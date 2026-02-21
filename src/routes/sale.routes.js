import { Router } from "express";
import {
  createSale,
  listSales,
  getSaleDetail,
  refundSale,
} from "../controllers/sale.controller.js";
import { getSalesSummary } from "../controllers/salesReport.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", verifyJWT, listSales);
router.get("/summary", verifyJWT, getSalesSummary);
router.get("/:sale_id", verifyJWT, getSaleDetail);
router.post("/:sale_id/refund", verifyJWT, refundSale);
router.post("/", verifyJWT, createSale);

export default router;
