import mongoose, { Schema } from "mongoose";

const costEntrySchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      minlength: [1, "Description cannot be empty"],
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    total_cost: {
      type: Number,
      required: [true, "Total cost is required"],
      min: [0, "Total cost must be positive"],
    },
    allocated_amount: {
      type: Number,
      default: 0,
      min: [0, "Allocated amount cannot be negative"],
    },
    currency: {
      type: String,
      default: "BDT",
      uppercase: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      default: "active",
      enum: ["active", "fully_allocated", "cancelled"],
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

costEntrySchema.virtual("remaining_amount").get(function () {
  return this.total_cost - this.allocated_amount;
});

costEntrySchema.set("toJSON", { virtuals: true });
costEntrySchema.set("toObject", { virtuals: true });

costEntrySchema.index({ user_id: 1, date: -1 });
costEntrySchema.index({ description: "text" });

const CostEntry = mongoose.model("CostEntry", costEntrySchema);

export default CostEntry;
