import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.CLIENT_URL ||= "http://localhost:5173";
process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "root";
process.env.DB_PASSWORD ||= "rootpassword";
process.env.DB_NAME ||= "auth_app";
process.env.JWT_SECRET ||= "development_secret_with_enough_length";
process.env.NODE_ENV ||= "test";

const { AUTH_COOKIE_NAME } = await import("../src/config/cookie.js");
const { createChangePasswordHandler } = await import("../src/routes/user.router.js");

function createMockResponse() {
  return {
    cookies: {},
    payload: null,
    statusCode: 200,
    cookie(name, value, options) {
      this.cookies[name] = {
        value,
        options,
      };
      return this;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

describe("password session handling", () => {
  it("issues the replacement token with the incremented tokenVersion", async () => {
    const updateCalls = [];
    const signedTokens = [];
    const handler = createChangePasswordHandler({
      findUserWithPasswordById: async (userId) => ({
        id: userId,
        passwordHash: "old-hash",
      }),
      passwordHasher: {
        async compare(password, hash) {
          return password === "old-password" && hash === "old-hash";
        },
        async hash(password) {
          return `hashed:${password}`;
        },
      },
      signAccessToken(userId, tokenVersion) {
        signedTokens.push({ userId, tokenVersion });
        return `token:${userId}:${tokenVersion}`;
      },
      updateUserPassword: async (userId, passwordHash) => {
        updateCalls.push({ userId, passwordHash });

        return {
          id: userId,
          tokenVersion: 4,
        };
      },
    });
    const req = {
      body: {
        currentPassword: "old-password",
        newPassword: "new-password",
      },
      user: {
        id: 9,
      },
    };
    const res = createMockResponse();
    let nextError = null;

    await handler(req, res, (error) => {
      nextError = error;
    });

    assert.equal(nextError, null);
    assert.deepEqual(updateCalls, [
      {
        userId: 9,
        passwordHash: "hashed:new-password",
      },
    ]);
    assert.deepEqual(signedTokens, [
      {
        userId: 9,
        tokenVersion: 4,
      },
    ]);
    assert.equal(res.cookies[AUTH_COOKIE_NAME].value, "token:9:4");
    assert.equal(res.payload.message, "Đổi password thành công.");
  });
});
