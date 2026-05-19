import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// backend/uploads/avatars
const avatarUploadDir = path.resolve(__dirname, "../../uploads/avatars");

// Tự tạo folder nếu chưa tồn tại
fs.mkdirSync(avatarUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, avatarUploadDir);
  },

  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();

    // Ví dụ: user-1-1712345678900.png
    const filename = `user-${req.user.id}-${Date.now()}${ext}`;

    cb(null, filename);
  },
});

function fileFilter(req, file, cb) {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];

  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error("Chỉ cho phép upload ảnh JPG, PNG hoặc WEBP"));
  }

  cb(null, true);
}

export const uploadAvatar = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
});