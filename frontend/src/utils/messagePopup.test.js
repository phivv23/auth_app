import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { openMessagePopup } from "./messagePopup.js";

const originalWindow = globalThis.window;
const originalCustomEvent = globalThis.CustomEvent;

afterEach(() => {
  globalThis.window = originalWindow;
  globalThis.CustomEvent = originalCustomEvent;
});

describe("message popup helper", () => {
  it("dispatches the event consumed by the popup manager", () => {
    let dispatchedEvent = null;

    globalThis.CustomEvent = class CustomEvent {
      constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
      }
    };
    globalThis.window = {
      dispatchEvent(event) {
        dispatchedEvent = event;
      },
    };

    openMessagePopup(42);

    assert.equal(dispatchedEvent.type, "open-message-popup");
    assert.deepEqual(dispatchedEvent.detail, {
      userId: 42,
    });
  });
});
