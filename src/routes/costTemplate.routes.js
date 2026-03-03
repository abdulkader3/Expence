import { Router } from "express";
import {
  createCostTemplate,
  getCostTemplates,
  getCostTemplateById,
  updateCostTemplate,
  deleteCostTemplate,
} from "../controllers/costTemplate.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/", verifyJWT, createCostTemplate);
router.get("/", verifyJWT, getCostTemplates);
router.get("/:id", verifyJWT, getCostTemplateById);
router.put("/:id", verifyJWT, updateCostTemplate);
router.delete("/:id", verifyJWT, deleteCostTemplate);

export default router;
