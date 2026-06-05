import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { request } from "./helpers/http.js";

process.env.CLIENT_URL ||= "http://localhost:5173";
process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "root";
process.env.DB_PASSWORD ||= "rootpassword";
process.env.DB_NAME ||= "auth_app";
process.env.JWT_SECRET ||= "development_secret_with_enough_length";
process.env.NODE_ENV ||= "test";

const { AUTH_COOKIE_NAME } = await import("../src/config/cookie.js");
const { createAuthRouter } = await import("../src/routes/auth.routes.js");
const { createRequestLogger } = await import("../src/middleware/requestLogger.js");
const { createApp } = await import("../src/server.js");
const { sendError } = await import("../src/utils/http.js");
const { signAccessToken, verifyAccessToken } = await import("../src/utils/token.js");

function createSilentApp(options = {}) {
  const silentLogger = {
    error() {},
    info() {},
    warn() {},
  };

  return createApp({
    errorLogger: silentLogger,
    requestLogger: createRequestLogger({ logger: silentLogger }),
    ...options,
  });
}

function getCookieValue(req, name) {
  const cookieHeader = req.get("cookie") || "";
  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  const cookie = cookies.find((item) => item.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : "";
}

describe("base route behavior", () => {
  it("returns AUTH_REQUIRED for /api/auth/me without a cookie", async () => {
    const response = await request(createSilentApp(), "/api/auth/me");

    assert.equal(response.status, 401);
    assert.equal(response.body.code, "AUTH_REQUIRED");
  });

  it("normalizes malformed JSON errors", async () => {
    const response = await request(createSilentApp(), "/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: "{",
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.code, "INVALID_JSON");
  });

  it("returns requestId on route errors", async () => {
    const response = await request(createSilentApp(), "/api/unknown", {
      headers: {
        "X-Request-Id": "route-test-request",
      },
    });

    assert.equal(response.status, 404);
    assert.equal(response.body.code, "ROUTE_NOT_FOUND");
    assert.equal(response.body.requestId, "route-test-request");
  });
});

describe("auth session revocation", () => {
  it("revokes a valid token on logout and rejects the stale token", async () => {
    const tokenVersionByUser = new Map([[7, 0]]);
    const token = signAccessToken(7, 0);
    const requireAuthMiddleware = (req, res, next) => {
      const authToken = getCookieValue(req, AUTH_COOKIE_NAME);

      try {
        const payload = verifyAccessToken(authToken);
        const currentTokenVersion = tokenVersionByUser.get(payload.userId) || 0;

        if (Number(payload.tokenVersion || 0) !== Number(currentTokenVersion)) {
          return sendError(
            res,
            401,
            "Phiên đăng nhập đã hết hiệu lực.",
            "SESSION_REVOKED"
          );
        }

        req.user = {
          id: payload.userId,
          name: "Test User",
        };
        return next();
      } catch {
        return sendError(res, 401, "Token sai hoặc đã hết hạn.", "INVALID_TOKEN");
      }
    };
    const authRouter = createAuthRouter({
      authRateLimit: (req, res, next) => next(),
      incrementUserTokenVersion: async (userId) => {
        tokenVersionByUser.set(
          Number(userId),
          Number(tokenVersionByUser.get(Number(userId)) || 0) + 1
        );
      },
      requireAuthMiddleware,
    });
    const app = createSilentApp({
      authRouter,
    });

    const logoutResponse = await request(app, "/api/auth/logout", {
      method: "POST",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
        Origin: "http://localhost:5173",
      },
    });

    assert.equal(logoutResponse.status, 200);
    assert.equal(tokenVersionByUser.get(7), 1);

    const staleSessionResponse = await request(app, "/api/auth/me", {
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
      },
    });

    assert.equal(staleSessionResponse.status, 401);
    assert.equal(staleSessionResponse.body.code, "SESSION_REVOKED");
  });
});
