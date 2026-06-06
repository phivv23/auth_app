import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  connectRealtimeStream,
  subscribeRealtimeListener,
} from "./realtimeConnection.js";

describe("realtime connection helper", () => {
  it("opens one unified realtime stream and dispatches events by namespace", () => {
    const registry = new Map();
    const calls = [];
    const received = [];

    subscribeRealtimeListener(registry, "messages", "message", (event) => {
      received.push(`message:${event.data}`);
    });
    subscribeRealtimeListener(registry, "notifications", "notification", (event) => {
      received.push(`notification:${event.data}`);
    });

    const connection = connectRealtimeStream(registry, (url, options) => {
      calls.push({ options, url });

      return {
        close() {},
      };
    });

    assert.equal(connection && typeof connection.close, "function");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "http://localhost:5000/api/realtime/stream");
    assert.equal(typeof calls[0].options.listeners.message, "function");
    assert.equal(typeof calls[0].options.listeners.notification, "function");

    calls[0].options.listeners.message({ data: "m1" });
    calls[0].options.listeners.notification({ data: "n1" });

    assert.deepEqual(received, ["message:m1", "notification:n1"]);
  });
});
