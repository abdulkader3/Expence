import { Router } from "express";
import {
  createCostEntry,
  listCostEntries,
  getCostEntryDetail,
} from "../controllers/costEntry.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", verifyJWT, listCostEntries);
router.get("/:cost_id", verifyJWT, getCostEntryDetail);
router.post("/", verifyJWT, createCostEntry);

export default router;
