import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import authRoutes from "./routes/auth.routes.js";
import protectedRoutes from "./routes/protected.routes.js";
import userRoutes from "./routes/user.router.js";
import postRoutes from "./routes/post.route.js";
import path from "path";
import { fileURLToPath } from "url";
import notificationRoutes from "./routes/notification.routes.js";
import friendRoutes from "./routes/friend.routes.js";
import messageRoutes from "./routes/message.routes.js";
import reportRoutes from "./routes/report.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import storyRoutes from "./routes/story.routes.js";
import { createHealthRouter } from "./health.js";
import { requireTrustedOrigin } from "./middleware/csrf.js";
import { createRequestLogger } from "./middleware/requestLogger.js";
import { applySecurityMiddleware } from "./middleware/security.js";
import { sendError } from "./utils/http.js";

export const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.resolve(__dirname, "../uploads");

applySecurityMiddleware(app, {
  isProduction: env.nodeEnv === "production",
  trustProxy: env.trustProxy,
});

app.use(createRequestLogger());

// Cho phép frontend truy cập ảnh qua URL:
// http://localhost:5000/uploads/avatars/ten-file.png
app.use(
  "/uploads",
  express.static(uploadsRoot, {
    dotfiles: "deny",
    immutable: env.nodeEnv === "production",
    maxAge: env.nodeEnv === "production" ? "7d" : 0,
    setHeaders(res) {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  })
);

app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  })
);

app.use(cookieParser());
app.use(requireTrustedOrigin);
app.use(express.json({ limit: "1mb" }));

app.use("/api/health", createHealthRouter());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/protected", protectedRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/stories", storyRoutes);

/**
 * 404 handler.
 */
app.use((req, res) => {
  return sendError(res, 404, "Route không tồn tại.", "ROUTE_NOT_FOUND");
});

app.use((err, req, res, next) => {
  const errorDetails = {
    requestId: req.requestId || res.locals.requestId,
    method: req.method,
    path: req.originalUrl || req.url,
    message: err.message,
  };

  if (env.nodeEnv === "production") {
    console.error("Unhandled request error", errorDetails);
  } else {
    console.error(err);
  }

  if (err.type === "entity.parse.failed") {
    return sendError(res, 400, "JSON không hợp lệ.", "INVALID_JSON");
  }

  if (err.type === "entity.too.large") {
    return sendError(res, 413, "Payload quá lớn.", "PAYLOAD_TOO_LARGE");
  }

  return sendError(res, 500, "Lỗi server.", "INTERNAL_SERVER_ERROR");
});

if (env.nodeEnv !== "test") {
  app.listen(env.port, () => {
    console.log(`Backend running at http://localhost:${env.port}`);
  });
}
