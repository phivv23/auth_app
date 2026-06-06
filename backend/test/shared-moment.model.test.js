import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeParticipantIds,
  validateSharedMomentInput,
  validateSharedMomentItemInput,
} from "../src/models/sharedMoment.model.js";

describe("shared moment validation", () => {
  it("normalizes unique participant ids and removes the current user", () => {
    assert.deepEqual(
      normalizeParticipantIds([2, "3", 2, "bad", 1], 1),
      [2, 3]
    );
  });

  it("requires a title and at least one invited friend", () => {
    assert.equal(validateSharedMomentInput({ title: "", participantIds: [2] }).error, "Bạn cần đặt tên cho khoảnh khắc chung.");
    assert.equal(validateSharedMomentInput({ title: "Trip", participantIds: [] }).error, "Bạn cần chọn ít nhất một bạn bè.");
  });

  it("validates supported item sources", () => {
    assert.deepEqual(validateSharedMomentItemInput({ itemType: "post", postId: "4" }), {
      value: {
        itemType: "post",
        content: "",
        postId: 4,
        storyId: null,
        messageId: null,
      },
    });

    assert.equal(
      validateSharedMomentItemInput({ itemType: "message" }).error,
      "Tin nhắn không hợp lệ."
    );
    assert.equal(
      validateSharedMomentItemInput({ itemType: "note", content: "" }).error,
      "Bạn cần nhập nội dung ghi chú."
    );
  });
});
