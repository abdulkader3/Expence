import User from "../models/user.model.js";
import { asyncHandlers } from "../utils/asyncHandlers.js";
import { ApiErrors } from "../utils/ApiErrors.js";
import { UploadOnCloudinary } from "../utils/Cloudinary.js";

export const getProfile = asyncHandlers(async (req, res) => {
  const user = await User.findById(req.user._id).select(
    "-password_hash -refresh_token"
  );

  if (!user) {
    throw new ApiErrors(404, "User not found");
  }

  res.status(200).json({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone,
    company: user.company,
    avatar_url: user.avatar_url,
    roles: user.roles || [],
    created_at: user.createdAt,
  });
});

export const updateProfile = asyncHandlers(async (req, res) => {
  const { name, phone, company, email } = req.body;

  if (email) {
    throw new ApiErrors(400, "Email cannot be changed via this endpoint");
  }

  const updateFields = {};

  if (name !== undefined) {
    if (
      typeof name !== "string" ||
      name.trim().length < 2 ||
      name.trim().length > 100
    ) {
      throw new ApiErrors(400, "Name must be between 2 and 100 characters");
    }
    updateFields.name = name.trim();
  }

  if (phone !== undefined) {
    updateFields.phone = phone || null;
  }

  if (company !== undefined) {
    updateFields.company = company || null;
  }

  if (req.file) {
    const cloudinaryResponse = await UploadOnCloudinary(req.file.path);
    if (!cloudinaryResponse) {
      throw new ApiErrors(500, "Failed to upload avatar to cloud");
    }
    updateFields.avatar_url = cloudinaryResponse.url;
  }

  if (Object.keys(updateFields).length === 0) {
    throw new ApiErrors(400, "No valid fields to update");
  }

  const updatedUser = await User.findByIdAndUpdate(req.user._id, updateFields, {
    new: true,
  }).select("-password_hash -refresh_token");

  res.status(200).json({
    user: {
      id: updatedUser._id.toString(),
      name: updatedUser.name,
      email: updatedUser.email,
      phone: updatedUser.phone,
      company: updatedUser.company,
      avatar_url: updatedUser.avatar_url,
      roles: updatedUser.roles || [],
      created_at: updatedUser.createdAt,
    },
  });
});

export const getSettings = asyncHandlers(async (req, res) => {
  const user = await User.findById(req.user._id).select("settings");

  if (!user) {
    throw new ApiErrors(404, "User not found");
  }

  res.status(200).json(user.settings);
});

export const updateSettings = asyncHandlers(async (req, res) => {
  const {
    currency,
    notifications,
    biometric_lock_enabled,
    quick_add_default_partner,
    export_format,
  } = req.body;

  const updateFields = {};

  if (currency !== undefined) {
    if (typeof currency !== "string" || currency.trim().length !== 3) {
      throw new ApiErrors(400, "Currency must be a 3-letter ISO code");
    }
    updateFields["settings.currency"] = currency.trim().toUpperCase();
  }

  if (notifications !== undefined) {
    if (typeof notifications !== "object" || notifications === null) {
      throw new ApiErrors(400, "Notifications must be an object");
    }
    if (notifications.enabled !== undefined) {
      updateFields["settings.notifications.enabled"] = Boolean(
        notifications.enabled
      );
    }
    if (notifications.email !== undefined) {
      updateFields["settings.notifications.email"] = Boolean(
        notifications.email
      );
    }
    if (notifications.push !== undefined) {
      updateFields["settings.notifications.push"] = Boolean(notifications.push);
    }
  }

  if (biometric_lock_enabled !== undefined) {
    updateFields["settings.biometric_lock_enabled"] = Boolean(
      biometric_lock_enabled
    );
  }

  if (quick_add_default_partner !== undefined) {
    updateFields["settings.quick_add_default_partner"] =
      quick_add_default_partner || null;
  }

  if (export_format !== undefined) {
    const validFormats = ["csv", "json", "excel"];
    if (!validFormats.includes(export_format)) {
      throw new ApiErrors(
        400,
        `export_format must be one of: ${validFormats.join(", ")}`
      );
    }
    updateFields["settings.export_format"] = export_format;
  }

  if (Object.keys(updateFields).length === 0) {
    throw new ApiErrors(400, "No valid fields to update");
  }

  const updatedUser = await User.findByIdAndUpdate(req.user._id, updateFields, {
    new: true,
  }).select("settings");

  res.status(200).json(updatedUser.settings);
});
