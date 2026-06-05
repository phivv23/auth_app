import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildEnvConfig } from "../src/config/env.js";

const baseEnv = {
  CLIENT_URL: "http://localhost:5173",
  DB_HOST: "127.0.0.1",
  DB_PORT: "3306",
  DB_USER: "root",
  DB_PASSWORD: "rootpassword",
  DB_NAME: "auth_app",
  JWT_SECRET: "development_secret_with_enough_length",
};

describe("environment config", () => {
  it("builds development config with explicit trust proxy override", () => {
    const config = buildEnvConfig({
      ...baseEnv,
      NODE_ENV: "development",
      TRUST_PROXY: "true",
    });

    assert.equal(config.nodeEnv, "development");
    assert.equal(config.trustProxy, true);
    assert.equal(config.db.port, 3306);
  });

  it("rejects weak JWT secrets in production", () => {
    assert.throws(
      () =>
        buildEnvConfig({
          ...baseEnv,
          NODE_ENV: "production",
          CLIENT_URL: "https://example.com",
          JWT_SECRET: "short",
        }),
      /JWT_SECRET must be a strong random value/
    );
  });

  it("rejects non-HTTPS client origins in production", () => {
    assert.throws(
      () =>
        buildEnvConfig({
          ...baseEnv,
          NODE_ENV: "production",
          CLIENT_URL: "http://example.com",
          JWT_SECRET: "a".repeat(48),
        }),
      /CLIENT_URL must use HTTPS/
    );
  });

  it("enables trust proxy by default in production", () => {
    const config = buildEnvConfig({
      ...baseEnv,
      NODE_ENV: "production",
      CLIENT_URL: "https://example.com",
      JWT_SECRET: "a".repeat(48),
    });

    assert.equal(config.trustProxy, true);
  });
});
