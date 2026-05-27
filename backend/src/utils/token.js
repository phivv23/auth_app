import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

/**
 * Tạo JWT cho user.
 *
 * Payload chỉ nên chứa dữ liệu tối thiểu.
 * Ở đây chỉ lưu userId.
 *
 * Không lưu password.
 * Không lưu passwordHash.
 * Không lưu thông tin nhạy cảm.
 */
export function signAccessToken(userId, tokenVersion = 0) {
  return jwt.sign(
    {
      userId,
      tokenVersion,
    },
    env.jwtSecret,
    {
      expiresIn: env.jwtExpiresIn,
    }
  );
}

/**
 * Verify JWT.
 *
 * Nếu token sai, hết hạn, hoặc bị sửa,
 * jwt.verify sẽ throw error.
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtSecret);
}
