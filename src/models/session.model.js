import mongoose, { Schema } from "mongoose";
import crypto from "crypto";

const sessionSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    device_name: {
      type: String,
      default: null,
    },
    refresh_token_hash: {
      type: String,
      required: true,
    },
    ip: {
      type: String,
      default: null,
    },
    user_agent: {
      type: String,
      default: null,
    },
    expires_at: {
      type: Date,
      required: true,
      index: true,
    },
    revoked_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

sessionSchema.methods.revoke = async function () {
  this.revoked_at = new Date();
  await this.save();
};

sessionSchema.statics.createSession = async function (
  userId,
  refreshToken,
  deviceName,
  ip,
  userAgent,
  refreshTokenExpiryDays = 30
) {
  const refreshTokenHash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + refreshTokenExpiryDays);

  return await this.create({
    user_id: userId,
    device_name: deviceName,
    refresh_token_hash: refreshTokenHash,
    ip,
    user_agent: userAgent,
    expires_at: expiresAt,
  });
};

sessionSchema.statics.verifyRefreshToken = async function (
  userId,
  refreshToken
) {
  const refreshTokenHash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  const session = await this.findOne({
    user_id: userId,
    refresh_token_hash: refreshTokenHash,
    revoked_at: null,
    expires_at: { $gt: new Date() },
  });

  return session;
};

sessionSchema.statics.revokeSession = async function (userId, refreshToken) {
  const refreshTokenHash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  return await this.findOneAndUpdate(
    {
      user_id: userId,
      refresh_token_hash: refreshTokenHash,
    },
    { revoked_at: new Date() },
    { new: true }
  );
};

const Session = mongoose.model("Session", sessionSchema);

export default Session;
