import { Router } from "express";
import {
  createPartner,
  listPartners,
} from "../controllers/partner.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

router.get("/", verifyJWT, listPartners);
router.post("/", verifyJWT, upload.single("avatar"), createPartner);

export default router;
