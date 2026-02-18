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
