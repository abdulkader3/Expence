import mongoose, { Schema } from "mongoose";

const partnerSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$|^$/, "Please provide a valid email"],
    },
    avatar_url: {
      type: String,
      default: null,
    },
    notes: {
      type: String,
      default: null,
    },
    total_contributed: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

const Partner = mongoose.model("Partner", partnerSchema);

export default Partner;
