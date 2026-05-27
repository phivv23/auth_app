import { AUTH_COOKIE_NAME } from "../config/cookie.js";
import { env } from "../config/env.js";
import { sendError } from "../utils/http.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const allowedClientOrigin = new URL(env.clientUrl).origin;

function getHeaderOrigin(value) {
  if (!value) {
    return "";
  }

  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}
export function requireTrustedOrigin(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  if (!req.cookies?.[AUTH_COOKIE_NAME]) {
    return next();
  }

  const origin = req.get("origin");
  const referer = req.get("referer");
  const requestOrigin = origin || getHeaderOrigin(referer);

  if (requestOrigin === allowedClientOrigin) {
    return next();
  }

  return sendError(
    res,
    403,
    "Nguồn request không hợp lệ.",
    "UNTRUSTED_ORIGIN"
  );
}
