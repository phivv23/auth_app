import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createRequestLogger } from "../src/middleware/requestLogger.js";

function createMockResponse() {
  const listeners = {};

  return {
    locals: {},
    statusCode: 200,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    on(eventName, listener) {
      listeners[eventName] = listener;
    },
    emit(eventName) {
      listeners[eventName]?.();
    },
  };
}

describe("request logger", () => {
  it("adds a request id and logs completed requests", () => {
    const infoLogs = [];
    const middleware = createRequestLogger({
      logger: {
        info(message, details) {
          infoLogs.push({ message, details });
        },
      },
      now: () => 100,
      createRequestId: () => "generated-id",
    });
    const req = {
      method: "GET",
      url: "/api/health",
      headers: {},
      get() {
        return "";
      },
    };
    const res = createMockResponse();
    let nextCalled = false;

    middleware(req, res, () => {
      nextCalled = true;
    });
    res.emit("finish");

    assert.equal(nextCalled, true);
    assert.equal(req.requestId, "generated-id");
    assert.equal(res.locals.requestId, "generated-id");
    assert.equal(res.headers["X-Request-Id"], "generated-id");
    assert.equal(infoLogs[0].message, "Request completed");
    assert.equal(infoLogs[0].details.path, "/api/health");
  });

  it("logs slow requests with warn", () => {
    const warnLogs = [];
    const nowValues = [0, 1500];
    const middleware = createRequestLogger({
      logger: {
        warn(message, details) {
          warnLogs.push({ message, details });
        },
      },
      slowRequestMs: 1000,
      now: () => nowValues.shift(),
      createRequestId: () => "slow-id",
    });
    const req = {
      method: "POST",
      originalUrl: "/api/messages",
      headers: {
        "x-request-id": "incoming-id",
      },
      get(name) {
        return this.headers[name];
      },
    };
    const res = createMockResponse();

    middleware(req, res, () => {});
    res.emit("finish");

    assert.equal(req.requestId, "incoming-id");
    assert.equal(warnLogs[0].message, "Slow request");
    assert.equal(warnLogs[0].details.durationMs, 1500);
  });
});
