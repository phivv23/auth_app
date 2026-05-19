import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// backend/uploads
const uploadsRoot = path.resolve(__dirname, "../../uploads");

export async function deleteLocalUpload(fileUrl) {
  if (!fileUrl) return;

  // Chỉ xóa file local do app mình tạo
  if (!fileUrl.startsWith("/uploads/")) return;

  const relativePath = fileUrl.replace("/uploads/", "");

  const fullPath = path.resolve(uploadsRoot, relativePath);

  // Chống path traversal
  if (!fullPath.startsWith(uploadsRoot)) return;

  try {
    await fs.unlink(fullPath);
  } catch (error) {
    // Nếu file không tồn tại thì bỏ qua
    if (error.code !== "ENOENT") {
      console.error("Delete upload file error:", error);
    }
  }
}