import mongoose, { Schema } from "mongoose";

const costTemplateSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    name: {
      type: String,
      required: [true, "Template name is required"],
      trim: true,
      minlength: [1, "Name cannot be empty"],
      maxlength: [200, "Name cannot exceed 200 characters"],
    },
    unit_cost: {
      type: Number,
      required: [true, "Unit cost is required"],
      min: [0, "Unit cost must be positive"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    currency: {
      type: String,
      default: "BDT",
      uppercase: true,
    },
    category: {
      type: String,
      trim: true,
      maxlength: [100, "Category cannot exceed 100 characters"],
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

costTemplateSchema.index({ user_id: 1, is_active: 1 });
costTemplateSchema.index({ user_id: 1, category: 1 });

const CostTemplate = mongoose.model("CostTemplate", costTemplateSchema);

export default CostTemplate;
