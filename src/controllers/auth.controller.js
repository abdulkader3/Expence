import User from "../models/user.model.js";
import Session from "../models/session.model.js";
import { ApiErrors } from "../utils/ApiErrors.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { validateRegistration, validateLogin } from "../utils/validation.js";
import jwt from "jsonwebtoken";

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
      path: "/",
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

const loginUser = async (req, res) => {
  try {
    const { email, password, device_name } = req.body;

    const validationErrors = validateLogin({ email, password });
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationErrors,
        data: null,
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
        errors: [],
        data: null,
      });
    }

    if (
      user.locked_at &&
      user.lock_expires_at &&
      new Date() < user.lock_expires_at
    ) {
      return res.status(423).json({
        success: false,
        message:
          "Account is locked due to too many failed attempts. Please try again later.",
        errors: [],
        data: null,
      });
    }

    if (
      user.locked_at &&
      user.lock_expires_at &&
      new Date() >= user.lock_expires_at
    ) {
      user.locked_at = null;
      user.lock_expires_at = null;
      user.failed_login_attempts = 0;
      await user.save();
    }

    const isPasswordValid = await user.isPasswordCorrect(password);
    if (!isPasswordValid) {
      user.failed_login_attempts += 1;

      if (user.failed_login_attempts >= 5) {
        user.locked_at = new Date();
        const lockDuration = 30 * 60 * 1000;
        user.lock_expires_at = new Date(Date.now() + lockDuration);
        await user.save();

        console.error(
          `[LOGIN FAILED] Email: ${email}, IP: ${req.ip}, Reason: Account locked after 5 failed attempts`
        );

        return res.status(423).json({
          success: false,
          message:
            "Account locked due to too many failed attempts. Please try again after 30 minutes.",
          errors: [],
          data: null,
        });
      }

      await user.save();

      console.error(
        `[LOGIN FAILED] Email: ${email}, IP: ${req.ip}, Reason: Invalid password, Attempts: ${user.failed_login_attempts}/5`
      );

      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
        errors: [],
        data: null,
      });
    }

    user.failed_login_attempts = 0;
    user.locked_at = null;
    user.lock_expires_at = null;
    user.last_login = new Date();
    await user.save();

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    const ip = req.ip || req.connection?.remoteAddress || null;
    const userAgent = req.get("User-Agent") || null;

    await Session.createSession(
      user._id,
      refreshToken,
      device_name || null,
      ip,
      userAgent
    );

    console.info(
      `[LOGIN SUCCESS] Email: ${email}, IP: ${ip}, Device: ${device_name || "unknown"}`
    );

    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(200, "Login successful", {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
          },
          tokens: {
            access_token: accessToken,
            refresh_token: refreshToken,
          },
          expires_in: 3600,
        })
      );
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while logging in",
      errors: [],
      data: null,
    });
  }
};

const refreshToken = async (req, res) => {
  try {
    const refreshToken =
      req.body.refresh_token ||
      req.cookies.refreshToken ||
      req.headers["x-refresh-token"];

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token is required",
        errors: [],
        data: null,
      });
    }

    let decodedToken;
    try {
      decodedToken = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    } catch (error) {
      console.error(`[REFRESH TOKEN] Invalid token format: ${error.message}`);
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token",
        errors: [],
        data: null,
      });
    }

    const user = await User.findById(decodedToken.id);
    if (!user) {
      console.error(`[REFRESH TOKEN] User not found: ${decodedToken.id}`);
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token",
        errors: [],
        data: null,
      });
    }

    const session = await Session.verifyRefreshToken(user._id, refreshToken);
    if (!session) {
      console.error(
        `[REFRESH TOKEN] Session not found or revoked for user: ${user.email}`
      );
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token",
        errors: [],
        data: null,
      });
    }

    await session.revoke();

    const newAccessToken = user.generateAccessToken();
    const newRefreshToken = user.generateRefreshToken();

    await Session.createSession(
      user._id,
      newRefreshToken,
      session.device_name,
      session.ip,
      session.user_agent
    );

    console.info(
      `[REFRESH TOKEN SUCCESS] User: ${user.email}, IP: ${session.ip}`
    );

    return res.status(200).json(
      new ApiResponse(200, "Token refreshed successfully", {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        expires_in: 3600,
      })
    );
  } catch (error) {
    console.error(`[REFRESH TOKEN ERROR] ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while refreshing token",
      errors: [],
      data: null,
    });
  }
};

const logoutUser = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body.refresh_token;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token is required",
        errors: [],
        data: null,
      });
    }

    const userId = req.user._id;
    const revokeAll = req.query.all === "true";

    if (revokeAll) {
      await Session.updateMany(
        { user_id: userId, revoked_at: null },
        { revoked_at: new Date() }
      );
      console.info(
        `[LOGOUT ALL] User: ${req.user.email}, Revoked all sessions`
      );
    } else {
      const session = await Session.revokeSession(userId, refreshToken);
      if (!session) {
        return res.status(401).json({
          success: false,
          message: "Invalid or expired refresh token",
          errors: [],
          data: null,
        });
      }
      console.info(`[LOGOUT] User: ${req.user.email}, Session revoked`);
    }

    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    };

    return res
      .status(204)
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .end();
  } catch (error) {
    console.error(`[LOGOUT ERROR] ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || "Something went wrong while logging out",
      errors: [],
      data: null,
    });
  }
};

export { registerUser, loginUser, refreshToken, logoutUser };
