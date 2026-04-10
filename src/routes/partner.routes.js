import { Router } from "express";
import {
  createPartner,
  createNewPartner,
  createSelfPartner,
  listPartners,
  getPartnerDetail,
  getLeaderboard,
  syncPartnerAvatars,
} from "../controllers/partner.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

router.get("/", verifyJWT, listPartners);
router.get("/leaderboard", verifyJWT, getLeaderboard);
router.get("/:partner_id", verifyJWT, getPartnerDetail);
router.post("/", verifyJWT, upload.single("avatar"), createPartner);
router.post("/create", verifyJWT, createNewPartner);
router.post("/self", verifyJWT, createSelfPartner);
router.post("/sync-avatars", verifyJWT, syncPartnerAvatars);

export default router;
