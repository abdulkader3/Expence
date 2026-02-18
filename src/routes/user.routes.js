import { Router } from "express";
import {
  getProfile,
  updateProfile,
  getSettings,
  updateSettings,
} from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

router.get("/me", verifyJWT, getProfile);
router.patch("/me", verifyJWT, upload.single("avatar"), updateProfile);
router.get("/me/settings", verifyJWT, getSettings);
router.put("/me/settings", verifyJWT, updateSettings);

export default router;
