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
    recorded_by: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Recorded by user is required"],
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

const Transaction = mongoose.model("Transaction", transactionSchema);

export default Transaction;
