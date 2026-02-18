import User from "../models/user.model.js";
import { ApiErrors } from "../utils/ApiErrors.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { validateRegistration } from "../utils/validation.js";

const registerUser = async (req, res) => {
  try {
    const { name, email, password, phone, company } = req.body;

    const validationErrors = validateRegistration({
      name,
      email,
      password,
      phone,
      company,
    });
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationErrors,
        data: null,
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
        errors: [],
        data: null,
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password_hash: password,
      phone: phone || null,
      company: company || null,
    });

    const createdUser = await User.findById(user._id).select(
      "-password_hash -refresh_token"
    );

    const accessToken = createdUser.generateAccessToken();
    const refreshToken = createdUser.generateRefreshToken();

    await User.findByIdAndUpdate(user._id, { refresh_token: refreshToken });

    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    };

    return res
      .status(201)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(201, "User registered successfully", {
          user: {
            id: createdUser._id,
            name: createdUser.name,
            email: createdUser.email,
            phone: createdUser.phone,
            company: createdUser.company,
            created_at: createdUser.createdAt,
          },
          tokens: {
            access_token: accessToken,
            refresh_token: refreshToken,
          },
        })
      );
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while registering user",
      errors: [],
      data: null,
    });
  }
};

export { registerUser };
