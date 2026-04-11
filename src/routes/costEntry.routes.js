import { Router } from "express";
import {
  createCostEntry,
  listCostEntries,
  getCostEntryDetail,
  deleteCostEntry,
  listDeletedCostEntries,
} from "../controllers/costEntry.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", verifyJWT, listCostEntries);
router.get("/deleted", verifyJWT, listDeletedCostEntries);
router.get("/:cost_id", verifyJWT, getCostEntryDetail);
router.delete("/:cost_id", verifyJWT, deleteCostEntry);
router.post("/", verifyJWT, createCostEntry);

export default router;
