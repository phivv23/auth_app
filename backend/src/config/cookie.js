import { env } from "./env.js";

/**
 * Tên cookie chứa JWT.
 * Frontend không cần đọc cookie này.
 * Browser sẽ tự gửi cookie trong request nếu credentials được bật.
 */
export const AUTH_COOKIE_NAME = "auth_token";

export function getAuthCookieOptions() {
  return {
    /**
     * httpOnly: true
     *
     * JS phía frontend không đọc được cookie này bằng document.cookie.
     * Điều này giúp giảm rủi ro token bị lấy nếu có XSS.
     */
    httpOnly: true,

    /**
     * secure: true nghĩa là cookie chỉ gửi qua HTTPS.
     *
     * Localhost đang dùng HTTP nên development để false.
     * Production phải chạy HTTPS và nên để true.
     */
    secure: env.nodeEnv === "production",

    /**
     * sameSite: "lax"
     *
     * Giúp giảm rủi ro CSRF trong nhiều trường hợp phổ biến.
     * Với app học local frontend/backend cùng localhost, lax là đủ.
     */
    sameSite: "lax",

    /**
     * Cookie có hiệu lực trên toàn backend.
     */
    path: "/",

    /**
     * 7 ngày.
     */
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

export function getClearCookieOptions() {
  const { maxAge, ...optionsWithoutMaxAge } = getAuthCookieOptions();

  /**
   * clearCookie nên dùng cùng path/httpOnly/secure/sameSite
   * để browser xóa đúng cookie đã set.
   */
  return optionsWithoutMaxAge;
}