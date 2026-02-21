import mongoose, { Schema } from "mongoose";

const saleSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    product_name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      minlength: [1, "Product name cannot be empty"],
      maxlength: [200, "Product name cannot exceed 200 characters"],
    },
    quantity: {
      type: Number,
      default: 1,
      min: [1, "Quantity must be at least 1"],
    },
    sale_total: {
      type: Number,
      required: [true, "Sale total is required"],
      min: [0, "Sale total must be positive"],
    },
    currency: {
      type: String,
      default: "BDT",
      uppercase: true,
    },
    payment_method: {
      type: String,
      required: [true, "Payment method is required"],
      enum: {
        values: ["cash", "bank"],
        message: "Payment method must be either 'cash' or 'bank'",
      },
    },
    bank_id: {
      type: String,
      default: null,
    },
    bank_name: {
      type: String,
      default: null,
    },
    cash_holder: {
      type: String,
      default: null,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      default: "completed",
      enum: ["completed", "pending", "cancelled", "refunded"],
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

saleSchema.index({ user_id: 1, date: -1 });
saleSchema.index({ product_name: "text" });

const Sale = mongoose.model("Sale", saleSchema);

export default Sale;
