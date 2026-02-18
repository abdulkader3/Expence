import mongoose, { Schema } from "mongoose";

const receiptSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    filename: {
      type: String,
      required: [true, "Filename is required"],
    },
    mime_type: {
      type: String,
      required: [true, "MIME type is required"],
    },
    url: {
      type: String,
      required: [true, "URL is required"],
    },
    thumbnail_url: {
      type: String,
      default: null,
    },
    transaction_id: {
      type: Schema.Types.ObjectId,
      ref: "Transaction",
      default: null,
    },
    public_id: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

receiptSchema.index({ user_id: 1 });
receiptSchema.index({ transaction_id: 1 });

const Receipt = mongoose.model("Receipt", receiptSchema);

export default Receipt;
