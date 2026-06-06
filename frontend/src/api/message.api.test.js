import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { getConversationMessages } from "./message.api.js";

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
});

function installWindow() {
  globalThis.window = {
    setTimeout() {
      return 1;
    },
    clearTimeout() {},
  };
}

describe("message api", () => {
  it("uses beforeMessageId cursor when loading older messages", async () => {
    installWindow();

    let requestedUrl = "";
    globalThis.fetch = async (url) => {
      requestedUrl = url;

      return {
        ok: true,
        headers: {
          get() {
            return "";
          },
        },
        async json() {
          return {
            messages: [],
          };
        },
      };
    };

    await getConversationMessages({
      beforeMessageId: 123,
      conversationId: 5,
      limit: 40,
    });

    const url = new URL(requestedUrl);

    assert.equal(
      url.pathname,
      "/api/messages/conversations/5/messages"
    );
    assert.equal(url.searchParams.get("beforeMessageId"), "123");
    assert.equal(url.searchParams.get("limit"), "40");
    assert.equal(url.searchParams.has("page"), false);
  });
});
