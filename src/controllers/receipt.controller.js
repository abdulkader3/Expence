import Receipt from "../models/receipt.model.js";
import Transaction from "../models/transaction.model.js";
import mongoose from "mongoose";
import { asyncHandlers } from "../utils/asyncHandlers.js";
import { ApiErrors } from "../utils/ApiErrors.js";
import { UploadOnCloudinary } from "../utils/Cloudinary.js";

export const uploadReceipt = asyncHandlers(async (req, res) => {
  if (!req.file) {
    throw new ApiErrors(400, "No file uploaded");
  }

  const { transaction_id } = req.body;

  if (transaction_id && !mongoose.Types.ObjectId.isValid(transaction_id)) {
    throw new ApiErrors(400, "Invalid transaction ID format");
  }

  if (transaction_id) {
    const transaction = await Transaction.findById(transaction_id);
    if (!transaction) {
      throw new ApiErrors(404, "Transaction not found");
    }
  }

  const cloudinaryResponse = await UploadOnCloudinary(req.file.path);
  if (!cloudinaryResponse) {
    throw new ApiErrors(500, "Failed to upload receipt to cloud");
  }

  const receipt = await Receipt.create({
    user_id: req.user._id,
    filename: req.file.originalname,
    mime_type: req.file.mimetype,
    url: cloudinaryResponse.url,
    thumbnail_url: cloudinaryResponse.thumbnail_url || null,
    transaction_id: transaction_id || null,
    public_id: cloudinaryResponse.public_id,
  });

  if (transaction_id) {
    await Transaction.findByIdAndUpdate(transaction_id, {
      receipt_url: cloudinaryResponse.url,
      receipt_id: receipt._id.toString(),
    });
  }

  res.status(201).json({
    receipt_id: receipt._id.toString(),
    url: receipt.url,
    thumbnail_url: receipt.thumbnail_url,
  });
});
