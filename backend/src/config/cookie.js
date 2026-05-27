import { env } from "./env.js";


export const AUTH_COOKIE_NAME = "auth_token";

export function getAuthCookieOptions() {
  return {
    httpOnly: true,

    secure: env.nodeEnv === "production",

    sameSite: "lax",


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
