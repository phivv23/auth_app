import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createMemoryRateLimitStore,
  rateLimit,
} from "../src/middleware/rateLimit.js";

function createMockResponse() {
  return {
    headers: {},
    locals: {},
    statusCode: null,
    payload: null,
    setHeader(name, value) {
      this.headers[name] = value;
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

async function runMiddleware(middleware, req = { ip: "127.0.0.1" }) {
  const res = createMockResponse();
  let nextCalled = false;
  let nextError = null;

  await middleware(req, res, (error) => {
    nextCalled = !error;
    nextError = error || null;
  });

  return {
    res,
    nextCalled,
    nextError,
  };
}

describe("rateLimit middleware", () => {
  it("allows requests until the configured limit and then returns 429", async () => {
    const store = createMemoryRateLimitStore();
    const middleware = rateLimit({
      windowMs: 60_000,
      max: 2,
      keyPrefix: "test",
      store,
    });

    const first = await runMiddleware(middleware);
    const second = await runMiddleware(middleware);
    const third = await runMiddleware(middleware);

    assert.equal(first.nextCalled, true);
    assert.equal(second.nextCalled, true);
    assert.equal(third.nextCalled, false);
    assert.equal(third.res.statusCode, 429);
    assert.equal(third.res.payload.code, "RATE_LIMITED");
    assert.equal(third.res.headers["X-RateLimit-Limit"], "2");
    assert.equal(third.res.headers["Retry-After"], "60");
  });

  it("supports a custom store adapter", async () => {
    const keys = [];
    const store = {
      async increment(key, windowMs, now) {
        keys.push({ key, windowMs, now });

        return {
          count: 1,
          resetAt: now + windowMs,
        };
      },
    };
    const middleware = rateLimit({
      keyPrefix: "adapter",
      keyGenerator: (req) => req.user.id,
      store,
    });

    const result = await runMiddleware(middleware, {
      user: {
        id: 42,
      },
    });

    assert.equal(result.nextCalled, true);
    assert.equal(keys[0].key, "adapter:42");
  });
});
