import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const userSchema = new Schema(
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
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    password_hash: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
    },
    phone: {
      type: String,
      default: null,
    },
    company: {
      type: String,
      default: null,
    },
    refresh_token: {
      type: String,
      default: null,
    },
    last_login: {
      type: Date,
      default: null,
    },
    locked_at: {
      type: Date,
      default: null,
    },
    failed_login_attempts: {
      type: Number,
      default: 0,
    },
    lock_expires_at: {
      type: Date,
      default: null,
    },
    avatar_url: {
      type: String,
      default: null,
    },
    roles: {
      type: [String],
      default: [],
    },
    settings: {
      currency: {
        type: String,
        default: "USD",
        uppercase: true,
      },
      notifications: {
        enabled: {
          type: Boolean,
          default: true,
        },
        email: {
          type: Boolean,
          default: true,
        },
        push: {
          type: Boolean,
          default: true,
        },
      },
      biometric_lock_enabled: {
        type: Boolean,
        default: false,
      },
      quick_add_default_partner: {
        type: String,
        default: null,
      },
      export_format: {
        type: String,
        enum: ["csv", "json", "excel"],
        default: "csv",
      },
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password_hash")) {
    return next();
  }
  const salt = await bcrypt.genSalt(12);
  this.password_hash = await bcrypt.hash(this.password_hash, salt);
  next();
});

userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password_hash);
};

userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    { id: this._id, email: this.email },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );
};

userSchema.methods.generateRefreshToken = function () {
  return jwt.sign({ id: this._id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
  });
};

const User = mongoose.model("User", userSchema);

export default User;
