import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { extractSharedPostId, stripSharedPostUrl } from "./sharedPostMessage.js";

describe("shared post message helpers", () => {
  it("extracts post ids from absolute and relative share links", () => {
    assert.equal(
      extractSharedPostId("Xem bài này http://localhost:5173/posts/42?ref=share"),
      42
    );
    assert.equal(extractSharedPostId("Gửi bạn /posts/99"), 99);
    assert.equal(extractSharedPostId("không có link"), null);
  });

  it("strips share links while keeping the sender note", () => {
    assert.equal(
      stripSharedPostUrl("Đọc bài này nhé /posts/42\nhay lắm"),
      "Đọc bài này nhé\nhay lắm"
    );
  });
});
