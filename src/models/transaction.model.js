import mongoose, { Schema } from "mongoose";

const transactionSchema = new Schema(
  {
    partner_id: {
      type: Schema.Types.ObjectId,
      ref: "Partner",
      required: [true, "Partner ID is required"],
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
    },
    type: {
      type: String,
      required: [true, "Transaction type is required"],
      enum: ["contribution", "expense", "adjustment"],
    },
    description: {
      type: String,
      default: null,
    },
    category: {
      type: String,
      default: null,
    },
    context: {
      type: String,
      default: null,
    },
    receipt_url: {
      type: String,
      default: null,
    },
    receipt_id: {
      type: String,
      default: null,
    },
    currency: {
      type: String,
      default: "BDT",
    },
    transaction_date: {
      type: Date,
      default: null,
    },
    recorded_by: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Recorded by user is required"],
    },
    idempotency_key: {
      type: String,
      default: null,
      index: true,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

transactionSchema.index({ partner_id: 1, transaction_date: -1 });
transactionSchema.index({ recorded_by: 1 });
transactionSchema.index({ category: 1 });
transactionSchema.index({ transaction_date: -1 });
transactionSchema.index({ context: "text", description: "text" });

const Transaction = mongoose.model("Transaction", transactionSchema);

export default Transaction;
