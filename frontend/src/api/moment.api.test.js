import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  addSharedMomentItem,
  createSharedMoment,
  getSharedMoment,
  getSharedMoments,
  respondToSharedMoment,
} from "./moment.api.js";

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

function installFetchCapture(responseData = {}) {
  const requests = [];

  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url, options });

    return {
      ok: true,
      headers: {
        get() {
          return "";
        },
      },
      async json() {
        return responseData;
      },
    };
  };

  return requests;
}

describe("moment api", () => {
  it("passes timeout options through apiFetch", async () => {
    const timeoutCalls = [];
    globalThis.window = {
      setTimeout(callback, timeoutMs) {
        timeoutCalls.push(timeoutMs);
        return 1;
      },
      clearTimeout() {},
    };
    installFetchCapture({ moment: { id: 1 }, moments: [] });

    await getSharedMoments({ timeoutMs: 1234 });
    await createSharedMoment(
      {
        title: "Trip",
        participantIds: [2],
      },
      {
        timeoutMs: 5678,
      }
    );

    assert.deepEqual(timeoutCalls, [1234, 5678]);
  });

  it("builds list and detail URLs", async () => {
    installWindow();
    const requests = installFetchCapture({ moments: [] });

    await getSharedMoments({ status: "pending", limit: 30 });
    await getSharedMoment(12);

    const listUrl = new URL(requests[0].url);
    const detailUrl = new URL(requests[1].url);

    assert.equal(listUrl.pathname, "/api/moments");
    assert.equal(listUrl.searchParams.get("status"), "pending");
    assert.equal(listUrl.searchParams.get("limit"), "30");
    assert.equal(detailUrl.pathname, "/api/moments/12");
  });

  it("serializes create, respond and add item requests", async () => {
    installWindow();
    const requests = installFetchCapture({ moment: { id: 1 } });

    await createSharedMoment({
      title: "Trip",
      note: "note",
      mood: "vui",
      participantIds: [2, 3],
      initialItem: { itemType: "post", postId: 9 },
    });
    await respondToSharedMoment(1, "accepted");
    await addSharedMomentItem(1, { itemType: "note", content: "hello" });

    assert.equal(requests[0].options.method, "POST");
    assert.deepEqual(JSON.parse(requests[0].options.body), {
      title: "Trip",
      note: "note",
      mood: "vui",
      participantIds: [2, 3],
      initialItem: { itemType: "post", postId: 9 },
    });
    assert.equal(new URL(requests[1].url).pathname, "/api/moments/1/respond");
    assert.deepEqual(JSON.parse(requests[1].options.body), {
      status: "accepted",
    });
    assert.equal(new URL(requests[2].url).pathname, "/api/moments/1/items");
    assert.deepEqual(JSON.parse(requests[2].options.body), {
      itemType: "note",
      content: "hello",
    });
  });
});
