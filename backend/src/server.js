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

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cho phép frontend truy cập ảnh qua URL:
// http://localhost:5000/uploads/avatars/ten-file.png
app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));

app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    message: "Backend is running.",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/protected", protectedRoutes);

/**
 * 404 handler.
 */
app.use((req, res) => {
  res.status(404).json({
    message: "Route không tồn tại.",
  });
});

app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    message: "Lỗi server.",
  });
});



app.listen(env.port, () => {
  console.log(`Backend running at http://localhost:${env.port}`);
});