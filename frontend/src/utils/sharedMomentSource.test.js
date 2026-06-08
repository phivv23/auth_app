import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSharedMomentDeepLink,
  createSharedMomentSourceItem,
  getSharedMomentSourceLabel,
  isSameSharedMomentSource,
} from "./sharedMomentSource.js";

describe("shared moment source helpers", () => {
  it("creates source items for post, story and message", () => {
    assert.deepEqual(createSharedMomentSourceItem("post", "12"), {
      itemType: "post",
      postId: 12,
    });
    assert.deepEqual(createSharedMomentSourceItem("story", 13), {
      itemType: "story",
      storyId: 13,
    });
    assert.deepEqual(createSharedMomentSourceItem("message", 14), {
      itemType: "message",
      messageId: 14,
    });
  });

  it("rejects invalid source values", () => {
    assert.equal(createSharedMomentSourceItem("post", 0), null);
    assert.equal(createSharedMomentSourceItem("unknown", 1), null);
  });

  it("builds deep links and labels", () => {
    const sourceItem = createSharedMomentSourceItem("message", 15);

    assert.equal(
      buildSharedMomentDeepLink(sourceItem, { conversationId: 9 }),
      "/moments?messageId=15&conversationId=9"
    );
    assert.equal(getSharedMomentSourceLabel(sourceItem), "Tin nhắn đang chọn");
  });

  it("matches existing items by source id", () => {
    const sourceItem = createSharedMomentSourceItem("story", 22);

    assert.equal(
      isSameSharedMomentSource({ itemType: "story", storyId: 22 }, sourceItem),
      true
    );
    assert.equal(
      isSameSharedMomentSource({ itemType: "story", storyId: 23 }, sourceItem),
      false
    );
  });
});
