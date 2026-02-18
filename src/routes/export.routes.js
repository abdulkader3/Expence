import { Router } from "express";
import { exportTransactionsCSV } from "../controllers/partner.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/transactions", verifyJWT, exportTransactionsCSV);

export default router;
