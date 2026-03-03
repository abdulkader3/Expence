import mongoose, { Schema } from "mongoose";

const allocationSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    sale_id: {
      type: Schema.Types.ObjectId,
      ref: "Sale",
      required: [true, "Sale ID is required"],
    },
    cost_id: {
      type: Schema.Types.ObjectId,
      ref: "CostEntry",
    },
    cost_template_id: {
      type: Schema.Types.ObjectId,
      ref: "CostTemplate",
    },
    allocated_amount: {
      type: Number,
      required: [true, "Allocated amount is required"],
      min: [0, "Allocated amount cannot be negative"],
    },
    is_reversed: {
      type: Boolean,
      default: false,
    },
    reversed_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

allocationSchema.pre("save", function (next) {
  if (!this.cost_id && !this.cost_template_id) {
    throw new Error("Either cost_id or cost_template_id is required");
  }
  if (this.cost_id && this.cost_template_id) {
    throw new Error("Cannot specify both cost_id and cost_template_id");
  }
  next();
});

allocationSchema.index({ user_id: 1, sale_id: 1 });
allocationSchema.index({ user_id: 1, cost_id: 1 });
allocationSchema.index({ user_id: 1, cost_template_id: 1 });

const Allocation = mongoose.model("Allocation", allocationSchema);

export default Allocation;
