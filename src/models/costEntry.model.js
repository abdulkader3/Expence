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
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [1, "Quantity must be at least 1"],
      default: 1,
    },
    unit_cost: {
      type: Number,
      required: [true, "Unit cost is required"],
      min: [0, "Unit cost must be positive"],
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
    allocated_quantity: {
      type: Number,
      default: 0,
      min: [0, "Allocated quantity cannot be negative"],
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

costEntrySchema.virtual("remaining_quantity").get(function () {
  return this.quantity - this.allocated_quantity;
});

costEntrySchema.pre("save", function (next) {
  if (this.quantity && this.unit_cost && !this.isModified("total_cost")) {
    this.total_cost = this.quantity * this.unit_cost;
  }
  next();
});

costEntrySchema.set("toJSON", { virtuals: true });
costEntrySchema.set("toObject", { virtuals: true });

costEntrySchema.index({ user_id: 1, date: -1 });
costEntrySchema.index({ description: "text" });

const CostEntry = mongoose.model("CostEntry", costEntrySchema);

export default CostEntry;
