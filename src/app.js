import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import partnerRoutes from "./routes/partner.routes.js";
import transactionRoutes from "./routes/transaction.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import exportRoutes from "./routes/export.routes.js";
import syncRoutes from "./routes/sync.routes.js";
import saleRoutes from "./routes/sale.routes.js";
import costEntryRoutes from "./routes/costEntry.routes.js";
import allocationRoutes from "./routes/allocation.routes.js";
import { ApiErrors } from "./utils/ApiErrors.js";
import mongoose from "mongoose";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const getVersion = () => {
  try {
    const packageJson = JSON.parse(
      readFileSync(join(__dirname, "../package.json"), "utf8")
    );
    return packageJson.version || "1.0.0";
  } catch {
    return "1.0.0";
  }
};

const app = express();

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// Health check endpoint - lightweight, no DB queries
app.get("/health", (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus =
    dbState === 1 ? "ok" : dbState === 2 ? "connecting" : "disconnected";

  res.status(200).json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    db: dbStatus,
    queue: { pending: 0 },
    version: getVersion(),
  });
});

// Import Router
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/partners", partnerRoutes);
app.use("/api/v1/transactions", transactionRoutes);
app.use("/api/v1/uploads", uploadRoutes);
app.use("/api/v1/exports", exportRoutes);
app.use("/api/v1/sync", syncRoutes);
app.use("/api/v1/sales", saleRoutes);
app.use("/api/v1/cost-entries", costEntryRoutes);
app.use("/api/v1/allocations", allocationRoutes);

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

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      success: false,
      message: "File too large. Maximum size is 8MB",
      errors: [],
      data: null,
    });
  }

  return res.status(500).json({
    success: false,
    message: err.message || "Internal server error",
    errors: [],
    data: null,
  });
});

export { app };
