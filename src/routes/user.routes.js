import { Router } from "express";
import { getProfile, updateProfile } from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

router.get("/me", verifyJWT, getProfile);
router.patch("/me", verifyJWT, upload.single("avatar"), updateProfile);

export default router;
