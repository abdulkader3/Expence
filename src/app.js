import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import partnerRoutes from "./routes/partner.routes.js";
import transactionRoutes from "./routes/transaction.routes.js";
import { ApiErrors } from "./utils/ApiErrors.js";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// Health check endpoint - lightweight, no DB queries
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
  });
});

// Import Router
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/partners", partnerRoutes);
app.use("/api/v1/transactions", transactionRoutes);

// Route

// Global error handler
app.use((err, req, res, next) => {
  if (err instanceof ApiErrors) {
    return res.status(err.statusCode).json({
      success: err.success,
      message: err.message,
      errors: err.errors,
      data: err.data,
    });
  }

  return res.status(500).json({
    success: false,
    message: "Internal server error",
    errors: [],
    data: null,
  });
});

export { app };
