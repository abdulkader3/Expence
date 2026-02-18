import { Router } from "express";
import { uploadReceipt } from "../middlewares/multer.middleware.js";
import { uploadReceipt as uploadReceiptController } from "../controllers/receipt.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { ApiErrors } from "../utils/ApiErrors.js";

const router = Router();

router.post(
  "/receipts",
  verifyJWT,
  (req, res, next) => {
    uploadReceipt.single("file")(req, res, function (err) {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({
            success: false,
            message: "File too large. Maximum size is 8MB",
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message || "Invalid file",
        });
      }
      next();
    });
  },
  uploadReceiptController
);

export default router;
