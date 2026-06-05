import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { connectReconnectingEventSource } from "./reconnectingEventSource.js";

const originalEventSource = globalThis.EventSource;
const originalWindow = globalThis.window;

afterEach(() => {
  globalThis.EventSource = originalEventSource;
  globalThis.window = originalWindow;
});

describe("connectReconnectingEventSource", () => {
  it("reconnects with backoff and removes the active stream on close", () => {
    const instances = [];
    const scheduledTimeouts = [];

    class MockEventSource {
      constructor(url, options) {
        this.url = url;
        this.options = options;
        this.listeners = new Map();
        this.closed = false;
        instances.push(this);
      }

      addEventListener(eventName, listener) {
        this.listeners.set(eventName, listener);
      }

      close() {
        this.closed = true;
      }

      emit(eventName, event = {}) {
        this.listeners.get(eventName)?.(event);
      }
    }

    globalThis.EventSource = MockEventSource;
    globalThis.window = {
      setTimeout(callback, delayMs) {
        scheduledTimeouts.push({ callback, delayMs });
        return scheduledTimeouts.length;
      },
      clearTimeout() {},
    };

    const receivedMessages = [];
    const connection = connectReconnectingEventSource("/events", {
      listeners: {
        message(event) {
          receivedMessages.push(event.data);
        },
      },
    });

    assert.equal(instances.length, 1);
    assert.equal(instances[0].url, "/events");
    assert.equal(instances[0].options.withCredentials, true);

    instances[0].emit("message", { data: "first" });
    assert.deepEqual(receivedMessages, ["first"]);

    instances[0].emit("error");
    assert.equal(instances[0].closed, true);
    assert.equal(scheduledTimeouts[0].delayMs, 1000);

    scheduledTimeouts[0].callback();
    assert.equal(instances.length, 2);

    connection.close();
    assert.equal(instances[1].closed, true);
  });
});
