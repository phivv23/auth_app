import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { getFeedPosts, getVideoPosts } from "./post.api.js";

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

function installFetchCapture() {
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
          posts: [],
        };
      },
    };
  };

  return () => new URL(requestedUrl);
}

describe("post api cursor pagination", () => {
  it("uses cursor query for Feed pagination", async () => {
    installWindow();
    const getRequestedUrl = installFetchCapture();

    await getFeedPosts({
      cursor: "cursor-1",
      limit: 10,
    });

    const url = getRequestedUrl();

    assert.equal(url.pathname, "/api/posts/feed");
    assert.equal(url.searchParams.get("cursor"), "cursor-1");
    assert.equal(url.searchParams.get("limit"), "10");
    assert.equal(url.searchParams.has("page"), false);
  });

  it("uses cursor query for Watch pagination", async () => {
    installWindow();
    const getRequestedUrl = installFetchCapture();

    await getVideoPosts({
      cursor: "cursor-2",
      limit: 8,
    });

    const url = getRequestedUrl();

    assert.equal(url.pathname, "/api/posts/videos");
    assert.equal(url.searchParams.get("cursor"), "cursor-2");
    assert.equal(url.searchParams.get("limit"), "8");
    assert.equal(url.searchParams.has("page"), false);
  });
});
