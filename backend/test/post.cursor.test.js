import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createPostCursor,
  decodePostCursor,
} from "../src/models/post.model.js";

describe("post cursor helpers", () => {
  it("round trips createdAt and id through an opaque cursor", () => {
    const cursor = createPostCursor({
      createdAt: "2026-06-06T10:20:30.000Z",
      id: 42,
    });
    const decoded = decodePostCursor(cursor);

    assert.equal(typeof cursor, "string");
    assert.equal(decoded.id, 42);
    assert.equal(decoded.createdAt.toISOString(), "2026-06-06T10:20:30.000Z");
  });

  it("rejects malformed cursors", () => {
    assert.equal(decodePostCursor("not-a-cursor"), null);
    assert.equal(
      decodePostCursor(
        Buffer.from(JSON.stringify({ createdAt: "bad", id: 1 })).toString(
          "base64url"
        )
      ),
      null
    );
    assert.equal(
      decodePostCursor(
        Buffer.from(JSON.stringify({ createdAt: new Date().toISOString(), id: 0 })).toString(
          "base64url"
        )
      ),
      null
    );
  });
});
