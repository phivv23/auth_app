import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applySecurityMiddleware,
  getSecurityHeaders,
} from "../src/middleware/security.js";

describe("security middleware", () => {
  it("sets baseline hardening headers without HSTS in development", () => {
    const headers = getSecurityHeaders({
      isProduction: false,
    });

    assert.equal(headers["X-Content-Type-Options"], "nosniff");
    assert.equal(headers["X-Frame-Options"], "DENY");
    assert.equal(headers["Cross-Origin-Resource-Policy"], "cross-origin");
    assert.match(headers["Content-Security-Policy"], /frame-ancestors 'none'/);
    assert.equal(headers["Strict-Transport-Security"], undefined);
  });

  it("adds HSTS in production", () => {
    const headers = getSecurityHeaders({
      isProduction: true,
    });

    assert.match(headers["Strict-Transport-Security"], /max-age=/);
    assert.match(headers["Strict-Transport-Security"], /includeSubDomains/);
  });

  it("disables express fingerprinting and applies headers", () => {
    const calls = [];
    let middleware = null;
    const app = {
      disable(name) {
        calls.push(["disable", name]);
      },
      set(name, value) {
        calls.push(["set", name, value]);
      },
      use(handler) {
        middleware = handler;
      },
    };

    applySecurityMiddleware(app, {
      isProduction: true,
      trustProxy: true,
    });

    assert.deepEqual(calls, [
      ["disable", "x-powered-by"],
      ["set", "trust proxy", 1],
    ]);

    const responseHeaders = {};
    let nextCalled = false;
    const res = {
      setHeader(name, value) {
        responseHeaders[name] = value;
      },
    };

    middleware({}, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(responseHeaders["X-Content-Type-Options"], "nosniff");
    assert.match(responseHeaders["Strict-Transport-Security"], /max-age=/);
  });
});
