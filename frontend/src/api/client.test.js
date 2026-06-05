import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  ApiRequestError,
  apiFetch,
  getFileUrl,
  isRetryableApiError,
} from "./client.js";

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
});

function installWindow({ triggerTimeout = false } = {}) {
  globalThis.window = {
    setTimeout(callback) {
      if (triggerTimeout) {
        callback();
      }

      return 1;
    },
    clearTimeout() {},
  };
}

describe("apiFetch", () => {
  it("builds protected message media URLs from the API origin", () => {
    assert.equal(
      getFileUrl("/api/messages/media/message-id.txt"),
      "http://localhost:5000/api/messages/media/message-id.txt"
    );
  });

  it("throws a typed HTTP error with request metadata", async () => {
    installWindow();
    globalThis.fetch = async () => ({
      ok: false,
      status: 429,
      headers: {
        get(name) {
          return name === "X-Request-Id" ? "request-1" : "";
        },
      },
      async json() {
        return {
          message: "Bạn thao tác quá nhanh.",
          code: "RATE_LIMITED",
        };
      },
    });

    await assert.rejects(
      () => apiFetch("/limited"),
      (error) => {
        assert.equal(error instanceof ApiRequestError, true);
        assert.equal(error.message, "Bạn thao tác quá nhanh.");
        assert.equal(error.status, 429);
        assert.equal(error.code, "RATE_LIMITED");
        assert.equal(error.requestId, "request-1");
        return true;
      }
    );
  });

  it("throws a retryable timeout error", async () => {
    installWindow({ triggerTimeout: true });
    globalThis.fetch = async (url, options) => {
      if (options.signal.aborted) {
        throw new TypeError("aborted");
      }

      return {
        ok: true,
        async json() {
          return {};
        },
      };
    };

    await assert.rejects(
      () => apiFetch("/slow", { timeoutMs: 1 }),
      (error) => {
        assert.equal(error.name, "TimeoutError");
        assert.equal(error.code, "REQUEST_TIMEOUT");
        assert.equal(isRetryableApiError(error), true);
        return true;
      }
    );
  });

  it("normalizes network failures", async () => {
    installWindow();
    globalThis.fetch = async () => {
      throw new TypeError("fetch failed");
    };

    await assert.rejects(
      () => apiFetch("/offline"),
      (error) => {
        assert.equal(error.name, "NetworkError");
        assert.equal(error.code, "NETWORK_ERROR");
        assert.equal(isRetryableApiError(error), true);
        return true;
      }
    );
  });
});
