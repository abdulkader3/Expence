import { Router } from "express";
import {
  createSale,
  listSales,
  getSaleDetail,
  refundSale,
  deleteSale,
  listDeletedSales,
} from "../controllers/sale.controller.js";
import { getSalesSummary } from "../controllers/salesReport.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", verifyJWT, listSales);
router.get("/deleted", verifyJWT, listDeletedSales);
router.get("/summary", verifyJWT, getSalesSummary);
router.get("/:sale_id", verifyJWT, getSaleDetail);
router.post("/:sale_id/refund", verifyJWT, refundSale);
router.delete("/:sale_id", verifyJWT, deleteSale);
router.post("/", verifyJWT, createSale);

export default router;
